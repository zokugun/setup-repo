import path from 'node:path';
import process from 'node:process';
import { enquirer, logger } from '@zokugun/cli-utils';
import fse from '@zokugun/fs-extra-plus/async';
import { isNonEmptyString } from '@zokugun/is-it-type';
import { stringifyError, xtryAsync } from '@zokugun/xtry';
import { execa } from 'execa';
import { getRepository } from './utils/get-repository.js';
import { loadProject } from './utils/load-project.js';

export type CliOptions = {
	branch?: string;
	package?: string;
};

export async function run(options: CliOptions): Promise<void> {
	const branchOption = options.branch ?? 'master';
	const root = process.cwd();

	logger.beginTimer();

	const packageJson = await fse.readJSON(path.join(root, 'package.json'));
	if(packageJson.fails) {
		logger.fatal(stringifyError(packageJson.error));
	}

	const repoResult = getRepository(packageJson.value);
	if(repoResult.fails) {
		logger.fatal(stringifyError(packageJson.error));
	}

	const repository = repoResult.value;

	let packageName: string;

	if(isNonEmptyString<string>(options.package)) {
		packageName = options.package;
	}
	else {
		const project = await loadProject(root);
		if(project.fails) {
			logger.fatal(stringifyError(project.error));
		}

		if(isNonEmptyString<string>(project.value?.settings.package)) {
			packageName = project.value.settings.package;
		}
		else {
			logger.fatal('No package found in the options or in a repo-starter-kit config file');
		}
	}

	logger.info(`cwd: ${root}`);
	logger.info(`repository: ${repository}`);
	logger.info(`branch: ${branchOption}`);
	logger.info(`package: ${packageName}`);

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

	if(branchResult.value.stdout !== branchOption) {
		await execa('git', ['branch', '-M', branchOption], { cwd: root, stdio: 'pipe' });
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

	await execa('npm', ['exec', '--', 'repo-starter-kit@latest', '--repo', repository, '--create', '--package', packageName], { stdio: 'inherit' });

	logger.finishTimer();
}
