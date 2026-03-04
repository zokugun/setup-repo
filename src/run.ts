import path from 'node:path';
import process from 'node:process';
import { enquirer, logger } from '@zokugun/cli-utils';
import fse from '@zokugun/fs-extra-plus/async';
import { stringifyError, xtryAsync } from '@zokugun/xtry';
import { execa } from 'execa';
import { type CliOptions } from './types.js';
import { getRepository } from './utils/get-repository.js';

export async function run(options: CliOptions): Promise<void> {
	const root = process.cwd();

	logger.begin();

	const packageJson = await fse.readJSON(path.join(root, 'package.json'));
	if(packageJson.fails) {
		logger.fatal(stringifyError(packageJson.error));
	}

	const repoResult = getRepository(packageJson.value);
	if(repoResult.fails) {
		logger.fatal(stringifyError(packageJson.error));
	}

	const repository = repoResult.value;

	logger.info(`cwd: ${root}`);
	logger.info(`repository: ${repository}`);

	await enquirer.prompt({
		type: 'invisible',
		name: 'open',
		message: 'Press ENTER to continue...',
	});

	logger.info('Setup Git');

	const existsGit = await fse.isNonEmptyDir(path.join(root, '.git'));
	if(!existsGit) {
		await execa('git', ['init', '--quiet'], { cwd: root });
	}

	const branchResult = await xtryAsync(execa('git', ['branch', '--show-current'], { cwd: root, stdio: 'pipe' }));
	if(branchResult.fails) {
		logger.fatal(stringifyError(branchResult.error));
	}

	if(branchResult.value.stdout !== options.branch) {
		await execa('git', ['branch', '-M', options.branch], { cwd: root, stdio: 'pipe' });
	}

	const remoteResult = await xtryAsync(execa('git', ['remote', '--verbose'], { cwd: root, stdio: 'pipe' }));
	if(remoteResult.fails) {
		logger.fatal(stringifyError(remoteResult.error));
	}

	const remoteUrl = `git@github.com:${repository}.git`;
	let addRemote = true;

	for(const line of remoteResult.value.stdout.split('\n')) {
		const parts = line.split(/\s+/);

		if(parts[0] === 'origin') {
			if(parts[1] === remoteUrl) {
				addRemote = false;
			}
			else {
				logger.fatal(`Existing remote: ${line}`);
			}
		}
		else if(parts[1] === remoteUrl) {
			logger.fatal(`Existing remote: ${line}`);
		}
	}

	if(addRemote) {
		const remoteResult = await xtryAsync(execa('git', ['remote', 'add', 'origin', remoteUrl], { cwd: root }));
		if(remoteResult.fails) {
			logger.error(stringifyError(remoteResult.error));
			return;
		}
	}

	logger.info('Setup GitHub');

	await execa('npm', ['exec', '--', 'repo-starter-kit@latest', '--repo', repository, '--create', '--package', options.package], { stdio: 'inherit' });

	logger.finish();
}
