var S = require('string');

exports.middleware = function(api, next){

    // parses the api_key from the Authorization request header:
    // header['Authorization'] = 'Token token="THIS-IS-MY-TOKEN"'
  var authorization = function(connection, actionTemplate, next){
    if(actionTemplate.authenticated === true){

      // if for dev we want to skip the API Key authentication for protected routes
      if (api.configData.general.skipAuthorization === "true") { return next(connection, true); }

      var redis = api.redis.client;
      var authorization = connection.rawConnection.req.headers.authorization;   

      // if authorization found in the header
      if (typeof(authorization) != "undefined") {
        try {

          // parse the apiKey from: 'Token token="THIS-IS-MY-TOKEN"'
          var apiKey = S(authorization.split("=")[1]).replaceAll('"', '').s;

          // does the apiKey exist in the hash of api keys in redis?
          redis.hget("api:keys", apiKey, function(error, email) {
            if(email === null) {
              errorResponse(connection);
              return next(connection, false); 
            }

            api.users.findByEmail(email).then(function(user) {
              console.log("debug : user =", user)
              if(api.users.isAccessible(user, actionTemplate)) {
                connection.currentUser = user;
                next(connection, true);  
              }
              else {
                errorResponse(connection);
                connection.response.error_description = "You are not allowed to access this resource";
                return next(connection, false);            
              }
              
            }, function(error) {
              errorResponse(connection);
              return next(connection, false);               
            });

          });

        } catch (err) {
          console.log("Could not parse API Key: " + err.message);
          errorResponse(connection);    
          next(connection, false);
        }
      // if authorization not found in the header
      } else {
        errorResponse(connection);
        next(connection, false);
      }

    }else{
      next(connection, true);
    }
  }

  var errorResponse = function(connection) {
    connection.response.error = "unauthorized";
    connection.response.error_description = "This action requires authorization to continue.";
    connection.rawConnection.responseHttpCode = 401;     
  };    

  api.actions.preProcessors.push(authorization);

  next();
}