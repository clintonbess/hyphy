// Crawls www.draislv.com/calendar/ and scrapes the prices
// associated with future events
var Xray = require('x-ray');
var xray = Xray();
var Horseman = require('node-horseman');
var fs = require('fs')
	, request = require('request');

var urlToScrape = 'http://www.ebay.com/sch/i.html?_sacat=0&_nkw=secret+of+mana+2&_frs=1';
var nextList = [];

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
				price: 'span.bold'	,
				title: 'a.vip'
			}
		];
		xray(sharedObject.html, 'li.sresult', resultsOptions)(function(err, results) {
			if (err) { reject(err); }
			else {
				results.forEach(function(element) {
					console.log(element);
					sharedObject.contents.push(element.title);
				});
				// console.log('before cleanup\n', sharedObject.contents);
				// removeUnwantedPages(sharedObject.contents);
				// console.log('contents:\n', sharedObject.contents);
				resolve(sharedObject);
			}
		});
	});
};
var asyncMap = function(arr, iter) {
	console.log('inside it');
 return new Promise(function(resolve, reject) {
   var index = 0;
   var next = function() {
     if(index < arr.length) {
    	iter(arr[index], index, function() { index++; next(); });
     } else {
       resolve();
     }
   };
   next();
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
var loadPhantomInstance = function () {
	var PATH_TO_PHANTOM = '/usr/local/bin/phantomjs';
	var options = {
		phantomPath: PATH_TO_PHANTOM,
		loadImages: true,
		injectJquery: true,
		webSecurity: false,
		ignoreSSLErrors: true,
		timeout: 5000,
		interval: 20
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
// starts scraping the url for information
var scrapeItem = function(searchObj, index, callback) {
	var screenshotPath = searchObj.searchTitle.replace(/ /g, '_') + '.png';
	screenshotPath = './screenshots/' + screenshotPath;
	var sharedObject = {
		currentURL: '',
		contents: [],
		pageHtml: '',
		timeVariable: '', // TODO:finish later
		pagesScraped: 0,
		searchTitle: searchObj.searchTitle,
		searchType: searchObj.searchType,
		screenshotPath: screenshotPath,
		promiseHolder: []
	};
	

	console.log('---------------------------------');
	console.log('Currently Scraping:', searchObj.searchTitle);
	console.log('---------------------------------');

	// console.log(sharedObject.screenshotPath);

	
	// .then(setItemView)
	// .then(setOptions)
	// .then(getData)

	 searchForTitle(sharedObject)
	.then(implementOptions)
	// .then(openFirstPage)
	.then(openNextPage)
	
	// .then(checkForMorePages)
	.then(function(){
		console.log('---------------------------------');
		console.log('Finished Scraping:', searchObj.searchTitle);
		console.log('---------------------------------');
		callback();
	})
	.catch(function (error){
		console.log('Error encountered while scraping the title: %s\n', searchObj.searchTitle, error);
		callback();
	});
};

var searchForTitle = function(sharedObject) {
	// console.log('test1:', typeof sharedObject.phantom);
	var ebayURL = 'http://www.ebay.com/';
	var phantom = loadPhantomInstance();
	return new Promise(function (resolve, reject) {
		phantom
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.on('urlChanged', function (newURL) {
				console.log(newURL);
				sharedObject.currentURL = newURL;
			})
			.open(ebayURL) // maybe we can search from any ebay page
			.type('input[name="_nkw"]', sharedObject.searchTitle)
			.keyboardEvent('keypress',16777221)
			.waitForNextPage()
			.screenshot(sharedObject.screenshotPath)
			.close()
			.then(function () {
				console.log('BLINK');
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'searchForTitle\'');
				reject(error);
			});
	});
};

var implementOptions = function(sharedObject) {
	var nextURL = '';
	var phantom = loadPhantomInstance();
	return new Promise(function (resolve, reject) {
		phantom
			.on('urlChanged', function (newURL) {
				console.log(newURL);
				sharedObject.currentURL = newURL;
			})
			.open(sharedObject.currentURL)
			.evaluate(function () {
				a = document.querySelectorAll('span.cbx');
				for(var i = 0; i < a.length; i++) {
					if (a[i].innerHTML == 'Completed listings') {
						nextURLNode = a[i].parentNode.parentNode.getAttribute('href');
						return nextURLNode;
					}
				}
			})
			.then(function (nextURL) {
				sharedObject.currentURL = nextURL;
			})
			.screenshot(sharedObject.screenshotPath)
			.close()
			.then(function () {
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'implementOptions\'');
				reject(error);
			});
	});
};

var openFirstPage = function(sharedObject) {
	sharedObject.screenshotPath = './screenshots/megamanx' 
		+ sharedObject.pagesScraped + '.png';
	var phantom = loadPhantomInstance();
	return new Promise(function (resolve, reject) {
		phantom
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.on('urlChanged', function (newURL) {
				console.log(newURL);
				sharedObject.currentURL = newURL;
			})
			.open(sharedObject.currentURL) // maybe we can search from any ebay page
			.evaluate(function() {
				var selector = document.querySelector('a.gspr.next');
				if (selector == null) { return 0; }
				else { return selector.getAttribute('href'); }
			})
			.then(function(selector) {
				// console.log('this is the value of selector afterwards', selector);
				if (selector != 0) {
					sharedObject.currentURL = selector;
					console.log('There are remaining pages');
				}
				else {
					console.log('There are no remaining pages');
				}
			})
			.screenshot(sharedObject.screenshotPath)
			.close()
			.then(function () {
				resolve(sharedObject);
			})
			.catch(function (error) {
				console.log('Error encountered inside \'openNewPage\'');
				reject(error);
			});
	});
};

var openNextPage = function(sharedObject) {

	var screenshotPath = sharedObject.searchTitle.replace(/ /g, '_') 
		+ sharedObject.pagesScraped + '.png';
	sharedObject.pagesScraped++;
	sharedObject.screenshotPath = './screenshots/' + screenshotPath;
	var phantom = loadPhantomInstance();
	return new Promise(function (resolve, reject) {
		var repeat = 0;
		var tempurl = '';
		console.log('getting data...from:', sharedObject.currentURL);
		phantom
			.open(sharedObject.currentURL)
			.evaluate(function() {
				var selector = document.querySelector('a.gspr.next');
				if (selector == null) { return 0; }
				else { return selector.getAttribute('href'); }
				return selector;
			})
			// scrape data here
			.then(function(selector) {
				var chain = phantom;
				if (selector != 0) {
					sharedObject.currentURL = selector;
					console.log('There are remaining pages');
					openNextPage(sharedObject)
					.then(function() {
						resolve(sharedObject);
					})
					.catch(function (error) {
						phantom.close()
						.then(function() {
							console.log('Error encountered inside \'openNextPage\'');
							reject(error);
						});
					});
				}
				else {
					console.log('There are no remaining pages');
					resolve(sharedObject);
				}
				chain
					.screenshot(sharedObject.screenshotPath)
					.close()
					.catch(function (error) {
						phantom.close()
						.then(function() {
							console.log('Error encountered inside \'openNextPage\'');
							reject(error);
						});
					});
			})
			.catch(function (error) {
				phantom.close()
				.then(function() {
					console.log('Error encountered inside \'openNextPage\'');
					reject(error);
				});
			});
	});
};
var beginScraping = function(searchObj) {
	return new Promise(function (resolve, reject) {
		var searchObjArray = [];
		searchObj.searchItems.forEach(function (searchItem) {
			var tempObj =  {
				searchTitle: searchItem,
				searchType: searchObj.searchType,
			};
			searchObjArray.push(tempObj);
		});
		asyncMap(searchObjArray, scrapeItem)
		.then(function() {
			resolve('beginScraping has finished!');
		});
	});
};

module.exports = function(searchType) {

	// start at ebay.com 
	// search for mega man x
	// get prices and titles
	// find remanining pages to scrape
	// repeat

	// // TODO check searchType as string type
	
	var search = ['mega man x super nintendo', 'super metroid super nintendo', 'donkey kong country super nintendo', 'captain america super nintendo'];
	// var search = ['lidar lite'] ;

	var searchObj = {
		searchItems: search,
		searchType: searchType || 'completed',
	};

	// searchObj.searchItems.push(search);
	// initializePhantom(searchObj)
	beginScraping(searchObj)
	.then(function (message) {
		console.log(message);
	});

};