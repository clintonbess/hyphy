// Crawls www.draislv.com/calendar/ and scrapes the prices
// associated with future events
var Xray = require('x-ray');
var xray = Xray();

var crypto = require('crypto')
  , fs = require('fs')
  , request = require('request');

var urlToScrape = 'http://www.draislv.com/calendar/';

var scrapeHead = function(sharedObject) {
	// init the sharedobject
	return new Promise(function(resolve, reject) {
		sharedObject.contents = [];
		xray(sharedObject.pageHtml,'head@html')(function(err, htmlData) {
			if (err) {
				reject(err);
			}
			else {
				sharedObject.html = htmlData;
				resolve(sharedObject);
			}
		});
	});
};
// scrapeBody extracts the html data from the body of the document
// then passes it down the promise pipeline
var scrapeBody = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		xray(sharedObject.pageHtml,'body@html')(function(err, htmlData) {
			if (err) {
				reject(err);
			}
			else {
				sharedObject.html += htmlData;
				resolve(sharedObject);
			}
		});
	});
}
// storePageData saves the html data of the requested url into 
// sharedObject variable. Later, this data is parsed by using the
// scrapeHead and scrapeBody functions
var storePageData = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		request(sharedObject.url, function(error, response, body) {
			// console.log(sharedObject.url);
			if (!error && response.statusCode == 200) {
				sharedObject.pageHtml = body;
				resolve(sharedObject);
			}
			else {
				reject(error);
			}
		});
	});
};
var getItem = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		var resultsOptions = [
			{
				href: '@href',
				cls: '@class',
				src: '@src'
			}
		];
		xray(sharedObject.html, 'a.uvc-overevent', resultsOptions)(function(err, results) {
			if (err) { reject(err); }
			else {
				results.forEach(function(element) {
					sharedObject.contents.push(element.href);
				});
				// console.log('before cleanup\n', sharedObject.contents);
				// removeUnwantedPages(sharedObject.contents);
				// console.log('contents:\n', sharedObject.contents);
				resolve(sharedObject);
			}
		});
	});
};
var removeUnwantedPages = function(sharedObject) {
	return new Promise(function(resolve, reject) {
		sharedObject.contents = hasDrais(sharedObject.contents);
		resolve(sharedObject);
	});
};
var hasDrais = function(urlArray) {
	var returnArray = [];
	returnArray = urlArray.filter(function(url) {
		return ( (url.indexOf('http://www.draisbeachclub.com') >= 0 ) 
			  || (url.indexOf('http://www.draisnightlife.com') >= 0 ) 
			  || (url.indexOf('http://www.draisafterhourslv.com') >= 0 ) );
	});
	return returnArray;
};
var printStats = function(sharedObject) {
	sharedObject.contents.forEach(function(item, index) {
		console.log(index, item);
	});
};
// starts scraping the url for information
var startScraping = function(url) {
	var sharedObject = {
		url: url,
		html: '',
		contents: [],
		pageHtml: ''

	};
	console.log('---------------------------------');
	console.log('Currently Scraping:', sharedObject.url);
	console.log('---------------------------------');
	storePageData(sharedObject)
	.then(scrapeHead)
	// .then(getJavascript)
	// .then(getCSS)
	.then(scrapeBody)
	// .then(getImageURLs)
	.then(getItem)
	.then(removeUnwantedPages)
	.then(printStats)
	.then(function(url){
		console.log('---------------------------------');
		console.log('Finished Scraping:', sharedObject.url);
		console.log('---------------------------------');
		// callback();
	})
	.catch(function(error){
		console.log('Error encountered while extracting the webpage\n', error);
		// callback();
	});
};

module.exports = function(phantomInstance) {

	startScraping(urlToScrape);
	phantomInstance
	// .userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
	// .on('urlChanged', function(newURL) {
	// 	console.log(newURL);
	// })
	// .open(url)
	// .status()
	// .then(function(statusCode) {
	// 	if (Number(statusCode >= 400)) {
	// 		throw 'Page failed with status:' + statusCode;
	// 	} 
	// })

	// // .type('input[name="field-keywords"]', 'whatsapp')
	// // .click('a[href="http://www.draislv.com/calendar/"]')
	// // .keyboardEvent('keypress',16777221)
	// // .waitForNextPage()
	// // .waitForSelector('li.s-result-item')
	// // .count('.uvc-date .uvc-s .uvc-multiple')
	// // .log()
	// .screenshot('./screenshots/drais_calender_page.png')


	// // .evaluate(function () {
 // 	//  	$ = window.$ || window.jQuery;
	//  //  	var fullHtml = $('body').html();
 // 	//  	console.log(fullHtml);
	// // })
	// .catch(function (err) {
	// 		console.log('Error: ', err);
	// 	})
	.close();
};