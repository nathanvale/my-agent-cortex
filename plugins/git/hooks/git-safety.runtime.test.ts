import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

interface HookRunResult {
	exitCode: number
	stdout: string
	stderr: string
}

const tempDirs: string[] = []

function runGit(cwd: string, args: string[]): HookRunResult {
	const proc = Bun.spawnSync(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		exitCode: proc.exitCode,
		stdout: new TextDecoder().decode(proc.stdout).trim(),
		stderr: new TextDecoder().decode(proc.stderr).trim(),
	}
}

function createTempRepo(): { cwd: string; branch: string } {
	const cwd = mkdtempSync(join(tmpdir(), 'git-safety-runtime-'))
	tempDirs.push(cwd)
	const init = runGit(cwd, ['init', '-b', 'main'])
	if (init.exitCode !== 0) {
		const fallback = runGit(cwd, ['init'])
		if (fallback.exitCode !== 0) {
			throw new Error(`git init failed: ${init.stderr} ${fallback.stderr}`)
		}
	}

	runGit(cwd, ['config', 'user.email', 'test@example.com'])
	runGit(cwd, ['config', 'user.name', 'Test User'])

	writeFileSync(join(cwd, 'README.md'), 'test\n')
	runGit(cwd, ['add', 'README.md'])
	runGit(cwd, ['commit', '-m', 'chore: init'])

	const branch = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout || 'main'
	return { cwd, branch }
}

function runSafetyHook(params: {
	command: string
	cwd: string
	mode: 'strict' | 'commit-guard' | 'advisory'
	protectedBranches?: string
}): HookRunResult {
	const payload = JSON.stringify({
		tool_name: 'Bash',
		tool_input: { command: params.command },
		cwd: params.cwd,
	})
	const scriptPath = join(import.meta.dir, 'git-safety.ts')
	const proc = Bun.spawnSync([process.execPath, scriptPath], {
		env: {
			...process.env,
			CLAUDE_GIT_SAFETY_MODE: params.mode,
			CLAUDE_PROTECTED_BRANCHES:
				params.protectedBranches ?? process.env.CLAUDE_PROTECTED_BRANCHES ?? '',
		},
		stdin: new TextEncoder().encode(payload),
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		exitCode: proc.exitCode,
		stdout: new TextDecoder().decode(proc.stdout),
		stderr: new TextDecoder().decode(proc.stderr),
	}
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop()
		if (dir) rmSync(dir, { recursive: true, force: true })
	}
})

describe('git-safety runtime mode behavior', () => {
	test('strict denies destructive commands', () => {
		const { cwd } = createTempRepo()
		const result = runSafetyHook({
			command: 'git reset --hard',
			cwd,
			mode: 'strict',
		})
		expect(result.exitCode).toBe(2)
		expect(result.stdout).toContain('"permissionDecision":"deny"')
	})

	test('commit-guard allows destructive command that strict would deny', () => {
		const { cwd } = createTempRepo()
		const result = runSafetyHook({
			command: 'git reset --hard',
			cwd,
			mode: 'commit-guard',
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toContain('"permissionDecision":"deny"')
	})

	test('commit-guard still denies commit on protected branch', () => {
		const { cwd, branch } = createTempRepo()
		const result = runSafetyHook({
			command: 'git commit -m "feat: test"',
			cwd,
			mode: 'commit-guard',
			protectedBranches: branch,
		})
		expect(result.exitCode).toBe(2)
		expect(result.stdout).toContain('"permissionDecision":"deny"')
		expect(result.stdout).toContain('Cannot commit directly')
	})

	test('advisory does not deny protected-branch commit attempts', () => {
		const { cwd, branch } = createTempRepo()
		const result = runSafetyHook({
			command: 'git commit -m "feat: test"',
			cwd,
			mode: 'advisory',
			protectedBranches: branch,
		})
		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toContain('"permissionDecision":"deny"')
	})
})
