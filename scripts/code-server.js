import cp from 'child_process';
import path from 'path';
import open from 'open';
import minimist from 'minimist';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	const args = minimist(process.argv.slice(2), {
		boolean: [
			'help',
			'launch'
		]
	});

	if (args.help) {
		console.log(
			'./scripts/code-server.sh|bat [options]\n' +
			' --launch              Opens a browser'
		);
		startServer(['--help']);
		return;
	}

	process.env['VSCODE_SERVER_PORT'] = '9888';

	const serverArgs = process.argv.slice(2).filter(v => v !== '--launch');
	const addr = await startServer(serverArgs);
	if (args['launch']) {
		open.default(addr);
	}
}

function startServer(programArgs) {
	return new Promise((s, e) => {
		const env = { ...process.env };
		const entryPoint = path.join(__dirname, '..', 'out', 'server-main.js');

		console.log(`Starting server: ${entryPoint} ${programArgs.join(' ')}`);
		const proc = cp.spawn(process.execPath, [entryPoint, ...programArgs], { env, stdio: [process.stdin, 'pipe', process.stderr] });
		proc.stdout.on('data', e => {
			const data = e.toString();
			process.stdout.write(data);
			const m = data.match(/Web UI available at (.*)/);
			if (m) {
				s(m[1]);
			}
		});

		proc.on('exit', (code) => process.exit(code || 0));

		process.on('exit', () => proc.kill());
		process.on('SIGINT', () => {
			proc.kill();
			process.exit(128 + 2);
		});
		process.on('SIGTERM', () => {
			proc.kill();
			process.exit(128 + 15);
		});
	});
}

main();
