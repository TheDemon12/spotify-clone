import { RequestHandler } from 'express';

let log: RequestHandler = (req, res, next) => {
	console.log('logging');
	next();
};

export default log;
