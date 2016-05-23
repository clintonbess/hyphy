var crypto = require('crypto')
  , fs = require('fs');

module.exports = function(phantomInstance) {



	var url = 'http://www.amazon.com/';
	phantomInstance
	.userAgent('Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36')
	.on('urlChanged', function(newURL) {
		console.log(newURL);
	})
	.open(url)
	.status()
	.then(function(statusCode) {
		if (Number(statusCode >= 400)) {
			throw 'Page failed with status:' + statusCode;
		} 
	})

	.type('input[name="field-keywords"]', 'whatsapp')
	.keyboardEvent('keypress',16777221)
	.waitForNextPage()
	// .waitForSelector('li.s-result-item')
	.count('li.s-result-item')
	.log()
	.screenshot('./screenshots/big.png')


	// .evaluate(function () {
 	//  	$ = window.$ || window.jQuery;
 //  	var fullHtml = $('body').html();
 //  	console.log(fullHtml);
	// })
	.catch(function (err) {
			console.log('Error: ', err);
		})
	.close();
};