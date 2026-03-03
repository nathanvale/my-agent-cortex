#!/usr/bin/env bun

/**
 * Session Summary Hook
 *
 * PreCompact hook that captures git state and appends a summary artifact
 * so the agent retains repo context after compaction.
 */

import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getRepoKeyFromGitRoot, postEvent } from './event-bus-client'
import { getMainWorktreeRoot } from './git-status-parser'
import { isGitRepo, runGit } from './git-utils'

interface PreCompactHookInput {
	cwd: string
	transcript_path?: string
}

function isPreCompactHookInput(value: unknown): value is PreCompactHookInput {
	if (!value || typeof value !== 'object') return false
	if (!('cwd' in value) || typeof value.cwd !== 'string') return false
	if (
		'transcript_path' in value &&
		value.transcript_path !== undefined &&
		typeof value.transcript_path !== 'string'
	) {
		return false
	}
	return true
}

async function getGitStateSummary(cwd: string): Promise<string> {
	const opts = { cwd, stderr: 'pipe' as const }

	const [branchResult, commitsResult, statusResult] = await Promise.all([
		runGit(['branch', '--show-current'], opts),
		runGit(['log', '--oneline', '--since=1 hour ago'], opts),
		runGit(['status', '--porcelain'], opts),
	])

	const branch =
		branchResult.exitCode === 0
			? branchResult.stdout || '(detached)'
			: '(detached)'

	const commits =
		commitsResult.exitCode === 0
			? commitsResult.stdout
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
					.slice(0, 10)
			: []

	const status =
		statusResult.exitCode === 0
			? statusResult.stdout
					.split('\n')
					.map((line) => line.trimEnd())
					.filter(Boolean)
					.slice(0, 20)
			: []

	let summary = `Branch: ${branch}`
	if (commits.length > 0) {
		summary += `\nSession commits:\n${commits.join('\n')}`
	}
	if (status.length > 0) {
		summary += `\nUncommitted:\n${status.join('\n')}`
	}
	return summary
}

async function ensureDirectory(dir: string): Promise<void> {
	await mkdir(dir, { recursive: true })
}

if (import.meta.main) {
	// Self-destruct timer: first executable line when run as entry point.
	// Set to 80% of hooks.json timeout (15s).
	const selfDestruct = setTimeout(() => {
		process.stderr.write('session-summary: timed out\n')
		process.exit(1)
	}, 12_000)
	selfDestruct.unref()

	try {
		let input: PreCompactHookInput
		try {
			const parsed = await Bun.stdin.json()
			if (!isPreCompactHookInput(parsed)) {
				process.exit(0)
			}
			input = parsed
		} catch {
			process.exit(0)
		}

		if (!(await isGitRepo(input.cwd))) {
			process.exit(0)
		}

		const gitRoot = await getMainWorktreeRoot(input.cwd)
		if (!gitRoot) {
			process.exit(0)
		}

		const repoName = getRepoKeyFromGitRoot(gitRoot)

		const gitState = await getGitStateSummary(input.cwd)
		const summaryDir = join(homedir(), '.claude', 'session-summaries')
		await ensureDirectory(summaryDir)
		const summaryPath = join(summaryDir, `${repoName}.md`)
		const existingSummary = (await Bun.file(summaryPath).exists())
			? await Bun.file(summaryPath).text()
			: ''
		const timestamp = new Date().toISOString()
		const newEntry = `\n---\n## Compaction ${timestamp}\n\n${gitState}\n`
		await Bun.write(summaryPath, existingSummary + newEntry)

		const contextParts: string[] = [
			`Git state at compaction:\n${gitState}`,
			'\nGit workflow: /git:commit, /git:squash, /git:checkpoint',
			'workflow skill handles: commits, PRs, history, worktrees, changelog, branch compare, squash, safety guards',
		]

		// Use plain stdout instead of JSON hookSpecificOutput.additionalContext.
		// Plugin hooks.json has a known bug (#16538) where additionalContext
		// is silently discarded. Plain stdout is reliably injected as context.
		console.log(contextParts.join('\n'))

		try {
			await postEvent(input.cwd, 'session.compacted', {
				repoName,
			})
		} catch {
			// event emission is best-effort
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
