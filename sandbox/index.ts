import 'dotenv/config';
import { client } from '../src/services/redis';

const run = async () => {
	await client.hSet('car1', {
		color: 'red',
		year: 2000
	});

	await client.hSet('car2', {
		color: 'blue',
		year: 2010
	});

	await client.hSet('car3', {
		color: 'green',
		year: 2020
	});

	const commands = [1, 2, 3].map((id) => client.hGetAll(`car${id}`));

	const results = await Promise.all(commands);

	console.log('results', results);
};
run();
