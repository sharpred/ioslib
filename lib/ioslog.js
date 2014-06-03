/**
 * iOS log stream class
 */
var log = require('./log'),
	logRegex = /^\[(INFO|DEBUG|ERROR|FATAL|WARN|TRACE)\]\s+(.*)/;


module.exports = exports = IOSLogger;

/**
 * name should be the name of the application and callback is an optional function
 * which should be called instead of calling log.  The callback will be called with
 * the level and message as arguments.
 */
function IOSLogger(name, callback) {
	if (!name) throw new Error("missing application name");
	this.name = name;
	this.logRE = new RegExp(name+'\\[\\w+\\:\\w+\\]\\s+(.*)'),
	this.logs = {};
	this.callback = callback;
}

/**
 * attach this logger to stream's stderr and stdout data event and will
 * automatically attach to end to flush any remaining data in the buffer
 */
IOSLogger.prototype.attach = function(stream) {
	stream.stderr.on('data', this.stderr.bind(this));
	stream.stdout.on('data', this.stdout.bind(this));
	stream.stderr.on('end', this.flush.bind(this));
	stream.stdout.on('end', this.flush.bind(this));
};

IOSLogger.prototype.stdout = function(buf) {
	performLog(this,'stdout',String(buf));
};

IOSLogger.prototype.stderr = function(buf) {
	performLog(this,'stderr',String(buf));
};

IOSLogger.prototype.flush = function() {
	performLog(this,'stdout','\n');
	performLog(this,'stderr','\n');
};

function parseLogLine(logger, buf, label) {
	var m = logger.logRE.exec(buf);
	label = label || 'debug';

	if (m) {
		buf = m[1];
	}

	m = logRegex.exec(buf);

	if (m) {
		label = m[1].toLowerCase();
		buf = m[2];
	}
	return {
		label: label,
		buffer: buf
	};
}

function handle(logger, label, message) {
	if (!message) return;
	if (logger.callback) {
		logger.callback(label,message);
	}
	else {
		log[label](message);
	}
}

function performLog (logger, label, buf) {
	if (!buf) return;
	var entry = logger.logs[label],
		lbl = (label === 'stderr' ? 'error' : 'debug');
	if (entry) {
		buf = entry.buf + buf;
		lbl = entry.lbl;
	} 
	var idx = buf.indexOf('\n'),
		start = 0,
		pending = [];
	if (idx < 0) {
		var obj = parseLogLine(logger, buf, lbl);
		handle(logger, obj.label, obj.buffer);
	}
	else {
		while (idx >= 0) {
			var line = buf.substring(start, idx);
			var obj = parseLogLine(logger, line, lbl);
			if (lbl && obj.label!==lbl) {
				handle(logger,lbl,pending.join('\n'));
				pending = [];
				lbl = undefined;
			}
			lbl = lbl || obj.label; //first line wins
			obj.buffer && pending.push(obj.buffer);
			start = idx + 1;
			idx = buf.indexOf('\n', start);
		}
		// console.log('idx=',idx,'start=',start,'length=',buf.length,'pending=',pending);
		if (start < buf.length) {
			var obj = parseLogLine(logger, buf.substring(start), lbl);
			if (lbl && obj.label!==lbl) {
				handle(logger,lbl,pending.join('\n'));
			}
			else {
				pending.push(obj.buffer);
			}
		}
		else {
			delete logger.logs[label];
		}
		if (pending.length) {
			handle(logger,lbl,pending.join('\n'));
		}
	}
}