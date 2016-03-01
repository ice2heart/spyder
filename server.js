var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var fs = require('fs');
var Promise = require("bluebird");
Promise.longStackTraces(); //debug
var app = express();

app.get('/scrape', function(req, res) {
  res.send('All done!');
});


var getPage = function(page) {
  return new Promise(function(resolve, reject) {
    request({
      url: page,
      encoding: 'binary',
      timeout: 120000,
      pool: {
        maxSockets: Infinity
      }
    }, function(error, response, html) {
      if (!error) {
        resolve(cheerio.load(iconv.encode(iconv.decode(new Buffer(html, 'binary'), 'cp1251'), 'utf8')));
      } else {
        reject(error);
      }
    });
  });

}

var grabber = function(next, list) {
  return new Promise((resolve) => {
    getPage(next).then(($) => {

      var page = $('div.factory-line');
      page.each(function(i, elem) {
        var info = {};
        info['link'] = $(this).find($('div.factory-line-content > h4 > a')).attr('href');
        info['name'] = $(this).find($('div.factory-line-content > h4 > a')).text();
        info['placeCity'] = $(this).find($('div.factory-line-location > a')).eq(0).text();
        info['placeState'] = $(this).find($('div.factory-line-location > a')).eq(-1).text();
        if (info.link) {
          list.push(info);
        }
      });
      var nextPage = $('ul.pagination.clearfix > li > a');
      var np = nextPage.filter(function(i, elem) {
        return (elem.children[0].data === 'Следующая');
      }).attr('href');
      if (np)
        grabber(np, list).then((pages) => {
          resolve(pages);
        });
      else
        resolve(list);
    }).catch((err) =>{
      console.log("err grabber", err);
    });
  });
}

var updateInfo = (pages) => {
  infos = [];
  pages.forEach((page) => {
    infos.push(new Promise((resolve, reject) => {
      getPage(page.link).then(($) => {
        page['outside'] = $('div.meta > a').eq(-1).attr('href');
        page['contacts'] = $('div.contacts > p').text();
        resolve(page);
      }).catch((err) => {
        console.log('updateInfo', err);
        resolve(page);
      });
    }));
  });
  return Promise.all(infos);
}

var getMail = (pages) => {
  var allPages = [];
  pages.forEach((page) => {
    allPages.push(new Promise((resolve) => {
      if (!page.outside) {
        resolve(page);
      } else {
        getPage(page.outside).then(($) => {
          var email = $('a[href^="mailto:"]').eq(0).attr('href');
          if (email) {
            page['email'] = email;
            console.log(page.outside, email);
          }
          resolve(page);
        }).catch((err) => {
          console.log("getMail err:", err);
          resolve(page);
        });
      }
    }));
  });
  return Promise.all(allPages);
}

url = 'http://www.wiki-prom.ru/41otrasl.html';

var grab = (urls) => {
  var grabbers = [];
  urls.forEach((url) => {
    grabbers.push(grabber(url, []).then(updateInfo).then(getMail));
  });
  return Promise.all(grabbers);
};

var urls = [];
for (var i = 1; i < 10; i++) {
  urls.push('http://www.wiki-prom.ru/' + i + 'otrasl.html');
};
grab(urls).then((res) => {
  var out = JSON.stringify(res);
  fs.writeFile('out.json', out);
  console.log('DONE!!!');
}, (err) => {
  console.log("all bad", err);
});

/*
app.listen('8081')
console.log('Magic happens on port 8081');
exports = module.exports = app;*/
