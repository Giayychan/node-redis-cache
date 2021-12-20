import express from 'express';
import axios from 'axios';
import redis from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 8000;

const app = express();

const client = redis.createClient({
	url: process.env.REDIS_URI
});

// Set response
const setResponse = (username, repos) => {
	return `<h2>${username} has ${repos} Github repos</h2>`;
};

// Make request to github for data
const getRepos = async (req, res, next) => {
	try {
		console.log('Fetching data.....');

		const { username } = req.params;

		const data = await getOrSetCache(username, 3600, async () => {
			const response = await axios.get(
				`https://api.github.com/users/${username}`
			);
			const repos = response.data.public_repos;
			return repos;
		});

		res.send(setResponse(username, data));
	} catch (error) {
		console.log('Failed to get repos', error.message);
		res.status(500);
	}
};

// Cache middleware
const cache = async (req, res, next) => {
	const { username } = req.params;
	try {
		const data = await client.get(username);
		if (data) {
			console.log('Cache Hit');
			res.send(setResponse(username, data));
		} else {
			console.log('Cache Miss');
			next();
		}
	} catch (error) {
		throw error;
	}
};

// Cache helper function
const getOrSetCache = async (key, expiry, cb) => {
	try {
		const data = await client.get(key);
		if (data !== null) return JSON.parse(data);
		const freshData = await cb();
		await client.setEx(key, expiry, JSON.stringify(freshData));
		return freshData;
	} catch (error) {
		throw error;
	}
};

// use cache helper in controller
app.get('/repos/:username', getRepos);
// or use cache as middleware
// app.get('/repos/:username', cache, getRepos);

app.listen(PORT, async () => {
	console.log('Server is listening on ' + PORT);
});

(async () => {
	client.on('error', (err) => console.log('Redis Client Error', err));

	await client.connect();
	console.log('Connected to redis instance');
})();
