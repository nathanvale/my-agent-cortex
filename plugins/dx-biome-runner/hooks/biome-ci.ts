#!/usr/bin/env bun

/**
 * Stop hook: Run project-wide Biome linting/formatting at session end.
 *
 * Self-contained -- uses only Bun built-in APIs.
 * Detects Bun workspace vs single package, runs appropriate command.
 * Reports ALL diagnostics (errors and warnings).
 * Exit 0 = clean, Exit 2 = errors (blocking).
 */

import { existsSync, readFileSync } from 'node:fs'

const BIOME_EXTENSIONS = [
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.json',
	'.jsonc',
	'.css',
]

interface BiomeDiagnostic {
	file: string
	line: number
	message: string
	code: string
	severity: 'error' | 'warning'
}

async function getGitRoot(): Promise<string | null> {
	const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const [exitCode, stdout] = await Promise.all([
		proc.exited,
		proc.stdout.text(),
		proc.stderr.text(),
	])
	if (exitCode !== 0) return null
	return stdout.trim() || null
}

/** Check if any changed/staged/untracked files are Biome-relevant. */
async function hasChangedBiomeFiles(): Promise<boolean> {
	const commands = [
		['git', 'diff', '--cached', '--name-only', '--diff-filter=d'],
		['git', 'diff', '--name-only', '--diff-filter=d'],
		['git', 'ls-files', '--others', '--exclude-standard'],
	]
	const outputs = await Promise.all(
		commands.map(async (cmd) => {
			const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
			const [output] = await Promise.all([proc.stdout.text(), proc.exited])
			return output
		}),
	)
	return outputs.some((output) =>
		output
			.trim()
			.split('\n')
			.some(
				(file) => file && BIOME_EXTENSIONS.some((ext) => file.endsWith(ext)),
			),
	)
}

/** Check if root is a Bun/npm workspace (array-form only). */
function isWorkspace(root: string): boolean {
	try {
		const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf-8')) as {
			workspaces?: unknown
		}
		return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0
	} catch {
		return false
	}
}

/** Parse Biome JSON reporter output into structured diagnostics. */
function parseBiomeOutput(stdout: string): BiomeDiagnostic[] {
	const diagnostics: BiomeDiagnostic[] = []
	try {
		const report = JSON.parse(stdout)
		if (report.diagnostics) {
			for (const d of report.diagnostics) {
				if (d.severity === 'error' || d.severity === 'warning') {
					diagnostics.push({
						file: d.location?.path?.file || 'unknown',
						line: d.location?.span?.start?.line || 0,
						message: d.description || d.message || 'Unknown issue',
						code: d.category || 'unknown',
						severity: d.severity,
					})
				}
			}
		}
	} catch {
		// If parse fails, return empty
	}
	return diagnostics
}

async function main() {
	// Check stop_hook_active to prevent infinite loops
	let stopHookActive = false
	try {
		const raw = await Bun.stdin.text()
		if (raw.trim()) {
			const input = JSON.parse(raw) as { stop_hook_active?: boolean }
			stopHookActive = input.stop_hook_active === true
		}
	} catch {
		// stdin empty or not JSON -- proceed normally
	}
	if (stopHookActive) {
		process.exit(0)
	}

	const root = await getGitRoot()
	if (!root) process.exit(0)

	if (!(await hasChangedBiomeFiles())) process.exit(0)

	// Biome needs a biome.json config to run
	if (!existsSync(`${root}/biome.json`) && !existsSync(`${root}/biome.jsonc`))
		process.exit(0)

	// For workspaces, use bun run check which is configured in package.json
	// For single packages, run biome check directly with JSON reporter
	const useWorkspaceScript = isWorkspace(root)
	const cmd = useWorkspaceScript
		? ['bun', 'run', '--filter', '*', 'check']
		: ['bunx', '@biomejs/biome', 'check', '--reporter=json', root]

	const proc = Bun.spawn(cmd, {
		cwd: root,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, CI: 'true' },
	})

	const [exitCode, stdout, stderr] = await Promise.all([
		proc.exited,
		proc.stdout.text(),
		proc.stderr.text(),
	])

	if (exitCode === 0) process.exit(0)

	// For workspace script mode, output is not JSON -- report raw
	if (useWorkspaceScript) {
		const combinedOutput = `${stdout}${stderr}`.trim()
		if (combinedOutput) {
			process.stderr.write(
				JSON.stringify({
					tool: 'biome-ci',
					status: 'error',
					errorCount: 1,
					errors: [
						{
							file: 'project',
							line: 0,
							message: combinedOutput.slice(0, 2000),
						},
					],
				}),
			)
			process.exit(2)
		}
		process.exit(0)
	}

	// Parse stdout first (biome --reporter=json writes JSON to stdout).
	// Fall back to stderr only if stdout yields nothing -- avoids corrupting
	// JSON parse when biome writes warnings/deprecations to stderr.
	let diagnostics = parseBiomeOutput(stdout)
	if (diagnostics.length === 0) {
		diagnostics = parseBiomeOutput(stderr)
	}

	// Guard: biome crashed but produced no parseable diagnostics
	if (diagnostics.length === 0) {
		process.stderr.write(
			`biome-ci: biome exited ${exitCode} but no diagnostics parsed (possible crash). Check biome manually.\n`,
		)
		process.exit(0)
	}

	const errors = diagnostics.filter((d) => d.severity === 'error')

	process.stderr.write(
		JSON.stringify({
			tool: 'biome-ci',
			status: errors.length > 0 ? 'error' : 'warning',
			errorCount: errors.length,
			warningCount: diagnostics.length - errors.length,
			errors: diagnostics.slice(0, 30).map((d) => ({
				file: d.file,
				line: d.line,
				message: `[${d.code}] ${d.message}`,
				severity: d.severity,
			})),
		}),
	)

	// Only block on errors, not warnings
	process.exit(errors.length > 0 ? 2 : 0)
}

if (import.meta.main) {
	const selfDestruct = setTimeout(() => {
		process.stderr.write('biome-ci: timed out\n')
		process.exit(0)
	}, 96_000)
	selfDestruct.unref()
	main()
}
