var express = require('express');
var path = require('path');
var logger = require('morgan');
var compression = require('compression');
var term = require('term.js');

var app = express();

var http = require('http').createServer(app);
var io = require('socket.io')(http);

var index = require('./routes/index')(io);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use([
	logger('dev'),
	require('stylus').middleware(path.join(__dirname, 'public')),
	compression(),
	term.middleware(),
	express.static(path.join(__dirname, 'public'))
]);

app.use('/', index);

app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: err
	});
});

module.exports = {
	app: app,
	http: http
};
