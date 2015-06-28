var on = function(el, type, handler, capture) {
	el.addEventListener(type, handler, capture || false);
}, off = function(el, type, handler, capture) {
	el.removeEventListener(type, handler, capture || false);
}, cancel = function(ev) {
	if (ev.preventDefault) ev.preventDefault();
	ev.returnValue = false;
	if (ev.stopPropagation) ev.stopPropagation();
	ev.cancelBubble = true;
	return false;
}, isBoldBroken = function(document) {
	var body = document.getElementsByTagName('body')[0];
	var el = document.createElement('span');
	el.innerHTML = 'hello world';
	body.appendChild(el);
	var w1 = el.scrollWidth;
	el.style.fontWeight = 'bold';
	var w2 = el.scrollWidth;
	body.removeChild(el);
	return w1 !== w2;
}, inherits = function(child, parent) {
	var f = function() {
		this.constructor = child;
	};
	f.prototype = parent.prototype;
	child.prototype = new f;
}, isWide = function(ch) {
	if (ch <= '\uff00') return false;
	return (ch >= '\uff01' && ch <= '\uffbe')
	|| (ch >= '\uffc2' && ch <= '\uffc7')
	|| (ch >= '\uffca' && ch <= '\uffcf')
	|| (ch >= '\uffd2' && ch <= '\uffd7')
	|| (ch >= '\uffda' && ch <= '\uffdc')
	|| (ch >= '\uffe0' && ch <= '\uffe6')
	|| (ch >= '\uffe8' && ch <= '\uffee');
};

Terminal.colors[256] = '#0c0a0d';
Terminal.colors[257] = '#f0f0f0';

Terminal.prototype.open = function(parent) {
	var self = this, i = 0, div;

	this.parent = parent || this.parent;

	if (!this.parent) {
		throw new Error('Terminal requires a parent element.');
	}

	// Grab global elements.
	this.context = this.parent.ownerDocument.defaultView;
	this.document = this.parent.ownerDocument;
	this.body = this.document.getElementsByTagName('body')[0];

	// Parse user-agent strings.
	if (this.context.navigator && this.context.navigator.userAgent) {
		this.isMac = !!~this.context.navigator.userAgent.indexOf('Mac');
		this.isIpad = !!~this.context.navigator.userAgent.indexOf('iPad');
		this.isIphone = !!~this.context.navigator.userAgent.indexOf('iPhone');
		this.isAndroid = !!~this.context.navigator.userAgent.indexOf('Android');
		this.isMobile = this.isIpad || this.isIphone || this.isAndroid;
		this.isMSIE = !!~this.context.navigator.userAgent.indexOf('MSIE');
	}

	// Create our main terminal element.
	this.element = this.document.createElement('div');
	this.element.className = 'terminal';
	this.element.style.outline = 'none';
	this.element.setAttribute('tabindex', 0);
	this.element.setAttribute('spellcheck', 'false');
	this.element.style.backgroundColor = this.colors[256];
	this.element.style.color = this.colors[257];

	// Create the lines for our terminal.
	this.children = [];
	for (; i < this.rows; i++) {
		div = this.document.createElement('div');
		this.element.appendChild(div);
		this.children.push(div);
	}
	this.parent.appendChild(this.element);

	// Draw the screen.
	this.refresh(0, this.rows - 1);

	// Initialize global actions that
	// need to be taken on the document.
	this.initGlobal();

	// Ensure there is a Terminal.focus.
	this.focus();

	// Start blinking the cursor.
	this.startBlink();

	// Bind to DOM events related
	// to focus and paste behavior.
	on(this.element, 'focus', function() {
		self.focus();
		if (self.isMobile) {
			Terminal._textarea.focus();
		}
	});

	// This causes slightly funky behavior.
	// on(this.element, 'blur', function() {
	//   self.blur();
	// });

	on(this.element, 'mousedown', function() {
		self.focus();
	});

	// Clickable paste workaround, using contentEditable.
	// This probably shouldn't work,
	// ... but it does. Firefox's paste
	// event seems to only work for textareas?
	on(this.element, 'mousedown', function(ev) {
		var button = ev.button != null
			? +ev.button
			: ev.which != null
			? ev.which - 1
			: null;

		// Does IE9 do this?
		if (self.isMSIE) {
			button = button === 1 ? 0 : button === 4 ? 1 : button;
		}

		if (button !== 2) return;

		self.element.contentEditable = 'true';
		setTimeout(function() {
			self.element.contentEditable = 'inherit'; // 'false';
		}, 1);
	}, true);

	// Listen for mouse events and translate
	// them into terminal mouse protocols.
	this.bindMouse();

	// Figure out whether boldness affects
	// the character width of monospace fonts.
	if (Terminal.brokenBold == null) {
		Terminal.brokenBold = isBoldBroken(this.document);
	}

	// this.emit('open');

	// This can be useful for pasting,
	// as well as the iPad fix.
	setTimeout(function() {
		self.element.focus();
	}, 100);
};

Terminal.prototype.refresh = function(start, end) {
	var x, y, i, line, out, ch, width, data, attr, bg, fg, flags, row, parent;

	if (end - start >= this.rows / 2) {
		parent = this.element.parentNode;
		if (parent) parent.removeChild(this.element);
	}

	width = this.cols;
	y = start;

	if (end >= this.lines.length) {
		this.log('`end` is too large. Most likely a bad CSR.');
		end = this.lines.length - 1;
	}

	for (; y <= end; y++) {
		row = y + this.ydisp;

		line = this.lines[row];
		out = '';

		if (y === this.y
			&& (this.ydisp === this.ybase || this.selectMode)
			&& !this.cursorHidden) {
			x = this.x;
		} else {
			x = -1;
		}

		attr = this.defAttr;
		i = 0;

		for (; i < width; i++) {
			data = line[i][0];
			ch = line[i][1];

			if (i === x) data = -1;

			if (data !== attr) {
				if (attr !== this.defAttr) {
					out += '</span>';
				}
				if (data !== this.defAttr) {
					if (data === -1) {
						out += '<span class="' + (this.cursorState ? 'reverse-video ' : '') + 'terminal-cursor">';
					}
					else {
						out += '<span style="';

						bg = data & 0x1ff;
						fg = (data >> 9) & 0x1ff;
						flags = data >> 18;

						if (flags & 1) {
							if (!Terminal.brokenBold) {
								out += 'font-weight:bold;';
							}
							if (fg < 8) fg += 8;
						}

						if (flags & 2) {
							out += 'text-decoration:underline;';
						}

						if (flags & 4) {
							if (flags & 2) {
								out = out.slice(0, -1);
								out += ' blink;';
							} else {
								out += 'text-decoration:blink;';
							}
						}

						if (flags & 8) {
							bg = (data >> 9) & 0x1ff;
							fg = data & 0x1ff;
							if ((flags & 1) && fg < 8) fg += 8;
						}

						if (flags & 16) {
							out += 'visibility:hidden;';
						}

						if (bg !== 256) {
							out += 'background-color:'
							+ this.colors[bg]
							+ ';';
						}

						if (fg !== 257) {
							out += 'color:'
							+ this.colors[fg]
							+ ';';
						}

						out += '">';
					}
				}
			}

			switch (ch) {
				case '&':
					out += '&amp;';
					break;
				case '<':
					out += '&lt;';
					break;
				case '>':
					out += '&gt;';
					break;
				default:
					if (ch <= ' ') {
						out += '&nbsp;';
					}
					else {
						if (isWide(ch)) i++;
						out += ch;
					}
					break;
			}

			attr = data;
		}

		if (attr !== this.defAttr) {
			out += '</span>';
		}

		this.children[y].innerHTML = out;
	}

	if (parent) {
		parent.appendChild(this.element);
	}
};

Terminal.prototype._cursorBlink = function() {
	if (Terminal.focus !== this)
		return;
	this.cursorState ^= 1;
	cursor = this.element.querySelector('.terminal-cursor');
	if (cursor.classList.contains('reverse-video')) {
		setTimeout(function() {
			cursor.classList.remove('reverse-video');
		}, 0);
	}
	else {
		setTimeout(function() {
			cursor.classList.add('reverse-video');
		}, 0);
	}
};

Terminal.prototype.showCursor = function() {
	if (!this.cursorState) {
		this.cursorState = 1;
		this.refresh(this.y, this.y);
	}
	else {
		this.refreshBlink();
		this.refresh(this.y, this.y);
	}
};

Terminal.prototype.startBlink = function() {
	if (!this.cursorBlink) return;
	var self = this;
	this._blinker = function() {
		self._cursorBlink();
	};
	this._blink = setInterval(this._blinker, 300);
};

Terminal.prototype.refreshBlink = function() {
	if (!this.cursorBlink) return;
	clearInterval(this._blink);
	this._blink = setInterval(this._blinker, 300);
};

$(function() {
	var socket = io.connect(),
		win = $(window),
		termel = $('#terminal');

	var charsize = function() {
		var test = $('<span>', {
			text: '0123456789',
			'class': 'metric',
			css: {
				display: 'none'
			}
		}).appendTo(termel),
		metric = {
			width: test.width() / 10,
			height: test.height()
		};
		test.remove();
		return metric;
	};

	var termBounds = function() {
		var metric = charsize();
		console.log({
			cols: Math.floor(termel.width() / metric.width),
			rows: Math.floor(termel.height() / metric.height)
		});
		return {
			cols: Math.floor(termel.width() / metric.width),
			rows: Math.floor(termel.height() / metric.height)
		};
	};

	socket.on('connect', function() {
		var metric = termBounds(),
			term = new Terminal({
				cols: metric.cols,
				rows: metric.rows,
				useStyle: false,
				screenKeys: true
			});

		term.open(termel[0]);

		socket.emit('client.init', metric);

		win.resize(function() {
			var metric = termBounds();
			socket.emit('client.resize', metric);
			term.resize(metric.cols, metric.rows);
		});

		term.on('data', function(data) {
			socket.emit('client.in', data);
		});
		term.on('title', function(title) {
			document.title = title;
		});

		socket.on('terminal.out', term.write.bind(term))
			.on('disconnect', term.destroy.bind(term));
	});
});
