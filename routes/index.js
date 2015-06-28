module.exports = function(io) {
	var express = require('express'),
		router = express.Router(),
		pty = require('pty.js');

	router.get('/', function(req, res) {
		res.render('index');
	});

	io.on('connection', function(socket) {
		var term;
		socket.on('client.init', function(metrics) {
			term = pty.spawn(process.env.SHELL || 'bash', [], {
				name: 'xterm-color',
				cols: metrics.cols,
				rows: metrics.rows,
				cwd: process.env.HOME,
				env: process.env
			});

			term.on('data', function(data) {
				socket.emit('terminal.out', data);
			});

			socket.on('client.in', function(data) {
				term.write(data);
			}).on('client.resize', function(metric) {
				term.resize(metric.cols, metric.rows);
			}).on('disconnect', function() {
				term.kill();
			});
		});
	});

	return router;
};
