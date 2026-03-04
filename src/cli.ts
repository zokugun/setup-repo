import { Command } from '@zokugun/cli-utils/commander';
import pkg from '../package.json' with { type: 'json' };
import { run } from './run.js';

const program = new Command();

program
	.version(pkg.version, '-v, --version')
	.description(pkg.description)
	.requiredOption('-p, --package <name>', 'NPM package that includes a repo-starter-kit config file')
	.option('-b, --branch <name>', 'The default branch name', 'master');

program.action(run);

program.parse();
