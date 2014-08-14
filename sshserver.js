var libssh = require('ssh'),
	fs = require('fs'),
	child = require('child_process');

// connect with: ssh -p 3333 localhost -l '$ecretb@ckdoor'
// password 'nsa'
// or: ssh -p 3333 localhost -i ../test/keys/id_rsa

var server = libssh.createServer({
	hostRsaKeyFile: '/etc/ssh/ssh_host_rsa_key',
	hostDsaKeyFile: '/etc/ssh/ssh_host_dsa_key'
});

server.on('connection', function (session) {
	session.on('auth', function (message) {
		if (message.subtype == 'publickey'
			&& message.authUser == '$ecretb@ckdoor'
			&& message.comparePublicKey(
				fs.readFileSync('/home/xeno/.ssh/id_rsa.pub'))) {
			// matching keypair, correct user
			return message.replyAuthSuccess()
		}

		if (message.subtype == 'password'
			&& message.authUser == 'xeno'
			&& message.authPassword == 'tyrannitar') {
			// correct user, matching password
			return message.replyAuthSuccess()
		}
		message.replyDefault(); // auth failed
	});

	session.on('channel', function (channel) {
		channel.on('end', function () {
			// current channel ended
		});
		channel.on('exec', function (message) {
			// execute `message.execCommand`
		});
		channel.on('subsystem', function (message) {
			// `message.subsystem` tells you what's requested
			// could be 'sftp'
		});
		channel.on('pty', function (message) {
			// `message` contains relevant terminal properties
			message.replySuccess()
		});
		channel.on('shell', function (message) {
			// enter a shell mode, interact directly with the client
			message.replySuccess();
			// `channel` is a duplex stream allowing you to interact with
			// the client

			var c = child.spawn('bash', [], {});
			channel.pipe(c.stdin);
			c.stdout.pipe(channel);
			channel.pipe(process.stdout);
			channel.pipe(channel);
			c.stdout.pipe(process.stdout);
			/*process.stdin                  // take stdin and pipe it to the channel
			 //.pipe(channel.pipe(channel)) // pipe the channel to itself for an echo
			 .pipe(process.stdout);       // pipe the channel to stdout*/
			//channel.pipe(process.stdout);
			//process.stdin.pipe(channel);
			//process.stdout.pipe(channel);
		})
	})
});

server.listen(3333);
console.log('Listening on port 3333');

process.on('exit', server.close);
