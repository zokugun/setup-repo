import { isRecord, isString } from '@zokugun/is-it-type';
import { type DResult, err, ok } from '@zokugun/xtry';

export function getRepository(packageJson: unknown): DResult<string> {
	if(isRecord(packageJson)) {
		if('repository' in packageJson) {
			if(isString(packageJson.repository)) {
				return extractRepoName(packageJson.repository);
			}
			else if(isRecord(packageJson.repository)) {
				if('url' in packageJson.repository) {
					if(isString(packageJson.repository.url)) {
						return extractRepoName(packageJson.repository.url);
					}
					else {
						return err('Url entry is not a string');
					}
				}
				else {
					return err('Repository entry dont have an url');
				}
			}
			else {
				return err('Repository entry is invalid');
			}
		}
		else {
			return err('No repository entry');
		}
	}
	else {
		return err('Not a record');
	}
}

function extractRepoName(url: string): DResult<string> {
	const match = /:\/\/github\.com\/(.*)\.git/.exec(url);

	if(match) {
		return ok(match[1]);
	}
	else {
		return err('Cannot extract the repo name');
	}
}
