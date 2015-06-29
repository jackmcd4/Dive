var redis = require('redis');
var Promise = require("bluebird");
Promise.promisifyAll(require("redis"));

var Engine = require('../../server/engines/engine.js');
var database = require('../../server/db/database.js');

var db = database.client;
var engine = new Engine(db);


var importYelpRestaurants = function(location, cb) {
  // - takes raw yelp json data and places all the restaurant records
  //  in the database of restaurants

  var yelp = require("yelp").createClient({
    consumer_key: "KjdDsNphOnZeY8w3YxJVcw", 
    consumer_secret: "6itM-P0nsf2qYvPpQCfnU6BABd0",
    token: "KyiFVSincgrzSHOBtHWA2KzGrakhBj5G",
    token_secret: "tc5_Rdwu8XqNb2fhM7TC7YDRkoI"
  });

  var queryName = "restaurant";
  var queryLocation = location;
  var firstloop = true;
  for (offset = 0; offset < 500; offset=offset+20) {
    yelp.search({term: queryName, location: queryLocation, sort: 0, offset: offset }, function(error, data) {
      if (!data) {
        cb(false);
      }
      else {

        var restaurantList = "restaurants:" + queryLocation;
        var description = "";
        for (var i = 0; i < data.businesses.length; i++) {
          restaurant = data.businesses[i];
          for (var j = 0; j < restaurant.categories.length; j++) {
            description = description + restaurant.categories[j][0];
            if (j !== restaurant.categories.length - 1) {
              description = description + ", ";
            }
          }      
          db.hmset(restaurant.id, {
            'name': restaurant.name,
            'id': restaurant.id,
            'image': restaurant.image_url,
            'description': description
          });

          db.sadd(restaurantList, restaurant.id);

        }
        if (firstloop) {
          firstloop = false;
          cb(true);
        }

      }
    });
  }   
};


module.exports.rateRestaurant = function(user, restaurantID, feeling) {
  // - adds restaurant ID to users "like" or "dislike" list and
  //   returns 'success' or 'failure'
  if (restaurantID !== undefined) {
    if (feeling === 0) {
      engine.dislikes.add(user, restaurantID);
    }
    else
    {
      engine.likes.add(user, restaurantID);
    }
    engine.similars.update(user);    
  }
};

module.exports.setLocation = function(userID, location) {
 // - returns array of restaurant records in json format
  db.set(userID + ":Location", location);
};

module.exports.getSuggestions = function(userID, cb) {
 // - returns array of restaurant records in json format

  db.get(userID + ":Location", function(err, location) {

    var innerfunc = function() {
      var restaurantList = "restaurants:" + location;
      var likesList = userID + ":Likes";
      var dislikesList = userID + ":Dislikes";
      var results = [];

      engine.suggestions.update(userID, function(suggestions) {
        var maxResults = 5;
        var limit = Math.min(maxResults, suggestions.length);
        for (var i = 0; i < limit; i++) {
          results.push(suggestions[i]);
        }

        db.sunionstore("ratedList", likesList, dislikesList);
        db.smembers(restaurantList, function(err, data) {
          db.smembers("ratedList", function(err, ratedList) {
            var index = 0;
            while ((results.length < maxResults) && (index < data.length)) {
              if (ratedList.indexOf(data[index]) === -1 && results.indexOf(data[index]) === -1) {
                results.push(data[index]);
              }
              index = index+1;
            }
            var results2 = [];
            for (var i = 0; i < results.length; i++) {
              db.hgetall(results[i], function(err, data) {
                results2.push(data);
                if (results2.length === maxResults) {
                  cb(results2);
                }
              });
            }
          });
        });
      });
    };

    db.exists("restaurants:" + location, function(err, doesExist) {
      if (!doesExist) {
        importYelpRestaurants(location, innerfunc);
      }
      else
      {
        innerfunc();
      }

    });
  });
};


module.exports.keep = function(user, restaurantID) {
// - saves a restaurant ID to user's "keep" list;
  var keptList = user + ":Kept";

  if (restaurantID !== undefined) {
      db.sadd(keptList, restaurantID);
  }
};

module.exports.getKept = function(user, cb) {
// - returns array of restaurant records in json format
  var keptList = user + ":Kept";
  var results = [];
  console.log("DO WE GET HERE");
  db.smembers(keptList, function(err, data) {
    for (var i = 0; i < data.length; i++) { 
      db.hgetall(data[i], function(err, record) {
        results.push(record);
        if (results.length === data.length) {
          cb(results);
        }
      });
    }
  });
};

// ************************************************************
// ALL CODE BELOW IS JUST FOR TESTING -- DELETE 

var raterLikes = engine.likes;
var raterDislikes = engine.dislikes;
var similars = engine.similars;
var suggestions = engine.suggestions;

var myFunction = function(arg) {
  suggestionsResponse = arg;
};

var myCallback = function(arg) {
  console.log("Suggestions");
  console.log(arg);
};

var myCallback2 = function(arg) {
  console.log("KEPT STUFF*****");
  console.log(arg);
};

module.exports.setLocation(1, "San Francisco");
module.exports.setLocation(2, "San Francisco");
module.exports.setLocation(3, "San Francisco");
module.exports.setLocation(4, "San Francisco");
//module.exports.getSuggestions(1, myCallback);


// setTimeout(function() {
//   db.smembers("restaurants:San Francisco", function(err, data) {
//     console.log("INSIDE LLOP");
//     for (var i = 0; i < 20; i++) {
//       console.log(data[i]);
//     }
//     for (var i = 0; i < 10; i++) {
//       module.exports.rateRestaurant(1, data[i]);
//     }
//     for (var j = 3; j < 15; j++) {
//       module.exports.rateRestaurant(2, data[j]);
//     }
//     for (var k = 4; k < 17; k++) {
//       module.exports.rateRestaurant(3, data[k]);
//     }

//     module.exports.keep(1, data[12]);
//     module.exports.keep(1, data[13]);

//   });}, 2000);


module.exports.rateRestaurant(1, "abc", 1);


module.exports.rateRestaurant(2, "efg", 1);



// setTimeout(function() { module.exports.getSuggestions(2, myCallback); }, 3000);
// setTimeout(function() { module.exports.getSuggestions(3, myCallback); }, 3000);
   
// setTimeout(function() { module.exports.getKept(1, myCallback2); }, 3000);

