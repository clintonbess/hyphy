
var Horseman = require('node-horseman')
	, validUrl = require('valid-url')
	, fs = require('fs')
	, prompt = require('prompt')
	, program = require('commander');

	console.log('we testin\'');

	program
		.version('1.0.0')
		.option('-x --action-to-perform [string]', 'The type of action to perform.')
		.option('-u --url [string]', 'Optional url used by certain actions')
		.parse(process.argv);

	var PATH_TO_PHANTOM = '/usr/local/bin/phantomjs';

	var supportedActions = [];

	var loadPhantomInstance = function () {

		var options = {
			phantomPath: PATH_TO_PHANTOM,
			loadImages: true,
			injectJquery: true,
			webSecurity: true,
			ignoreSSLErrors: true
		};

		var phantomInstance = new Horseman(options);

		phantomInstance.on('consoleMessage', function(msg) {
			console.log('Phantom page log: ', msg);
		});

		phantomInstance.on('error', function(msg) {
			console.log('Phantom page error: ', msg);
		});

		return phantomInstance;
	};

	var main = function () {
		var performAction = require('./actions/' + program.actionToPerform)
			, phantomInstance = loadPhantomInstance();

		prompt.start();
  	prompt.override = program;

		switch (program.actionToPerform) {
			case 'hello_world':
				prompt.get([{

					// What the property name should be in the result object
					name: 'url',
					// The promp message
					description: 'Enter a URL',
					// Wheter or not the user is required to enter a value
					required: true,
					// validates the user input
					conform: function (value) {
						// must provide a valid URL
						return validUrl.isWebUri(value);	
					}
				}], function(err, result) {
					performAction(phantomInstance, result.url);
				});
				break;
			case 'search_google':
				performAction(phantomInstance)
				break;
			case 'crawl_drais':
				performAction(phantomInstance)
				break;
			case 'crawl_megamanx':
				performAction(phantomInstance)
				break;
			default:
				phantomInstance.close();
				throw 'Invalid action specified. Supported actions include: ', supportedActions.join(', ');
		}
	};

(function () {
// Generate an array of supported actions based on the files present in the 'actions' directory
fs.readdir('./actions', function (err, files) {

  files.forEach(function (filename) {
    supportedActions.push(filename.split('.')[0]);
  });

  main();
});
})();