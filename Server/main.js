var express = require('express');
var bodyParser = require('body-parser')
var jwt = require('jsonwebtoken');

var app = express();
var apiRoutes = express.Router(); 

var handler = require("./RequestHandler");


const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(.\d{3})?Z$/;

function reviveDates(key, value) {
    if (typeof value === "string" && dateFormat.test(value)) {
        return new Date(value);
    }
    
    return value;
}

app.use(bodyParser.json({reviver: reviveDates}));

//////////////////////////////////////////////////////////
// POST authentication enpoints (login | logout | signup)
//////////////////////////////////////////////////////////
app.set('secretKey', 'coolhomieapp');

app.post('/login', function(req, response) {
	handler.handleLoginRequest(req.body, app.get('secretKey'), response);
});

app.post('/signup', function(req, response) {
	handler.handleSignUpRequest(req.body, app.get('secretKey'), response);
});

app.get('/logout', function(req, response) {

	response.writeHead(200, {'Content-Type': 'text/plain'});
	response.write(req.params.username);
	response.end();
});

//////////////////////////////////////////////////////////

apiRoutes.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['token'];
  console.log("request received: " + req.method + " " + req.originalUrl);
  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('secretKey'), function(err, decoded) {      
      if (err) {
        return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        req.user = decoded;    
        next();
      }
    });
  } else {

    // if there is no token, return 403 error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });    
  }
});

//////////////////////////////////////////////////////////
// GET request enpoints
//////////////////////////////////////////////////////////

apiRoutes.get('/courses/:id', function(req, response) {
	handler.handleGetByIdRequest("courses", req.params.id, response);
});

apiRoutes.get('/courses', function(req, response) {
  if (req.query.hasOwnProperty("userId")) {
    handler.handleGetCoursesByUserId(req, response);
  } else {
    handler.handleGetRequest("courses", req, response);
  }
});

apiRoutes.get('/assignments/:id', function(req, response) {
	handler.handleGetByIdRequest("assignments", req.params.id, response);
});

apiRoutes.get('/myAssignments', function(req, response) {
	handler.handleGetAssignmentsRequest(req, response);
});

apiRoutes.get('/assignments', function(req, response) {
  handler.handleGetRequest("assignments", req, response);
});

apiRoutes.get('/groups/:id', function(req, response) {
	handler.handleGetByIdRequest("groups", req.params.id, response);
});

apiRoutes.get('/groups', function(req, response) {
	handler.handleGetRequest("groups", req, response);
});

apiRoutes.get('/users/:id', function(req, response) {
	handler.handleGetByIdRequest("users", req.params.id, response);
});

apiRoutes.get('/tasks/:id', function(req, response) {
	handler.handleGetByIdRequest("tasks", req.params.id, response);
});

apiRoutes.get('/tasks', function(req, response) {
	handler.handleGetRequest("tasks", req, response);
});

//////////////////////////////////////////////////////////
// POST request enpoints
//////////////////////////////////////////////////////////

apiRoutes.post('/groups', function(req, response) {
	handler.handlePostRequest("groups", req, response);
});

apiRoutes.post('/tasks', function(req, response) {
	handler.handlePostRequest("tasks", req, response);
});

apiRoutes.post('/assignments', function(req, response) {
	handler.handlePostAssignmentsRequest(req, response);
});

apiRoutes.post('/courses', function(req, response) {
  handler.handlePostRequest("courses", req, response);
});

apiRoutes.post('/addOrDeleteUserToAssignment/:id', function(req, response) {
  handler.handlePostAddOrDeleteUserToAssignment(req, response);
});

//////////////////////////////////////////////////////////
// PUT request enpoints
//////////////////////////////////////////////////////////

apiRoutes.put('/users/:id', function(req, response) {
	handler.handlePutRequest("users", req, response);
});

apiRoutes.put('/groups/:id', function(req, response) {
	handler.handlePutRequest("groups", req, response);
});

apiRoutes.put('/tasks/:id', function(req, response) {
	handler.handlePutRequest("tasks", req, response);
});

apiRoutes.put('/assignments/:id', function(req, response) {
	handler.handlePutRequest("assignments", req, response);
});

//////////////////////////////////////////////////////////
// DELETE request enpoints
//////////////////////////////////////////////////////////

apiRoutes.delete('/groups/:id', function(req, response) {
	handler.handleDeleteRequest("groups", req, response);
});

apiRoutes.delete('/tasks/:id', function(req, response) {
	handler.handleDeleteRequest("tasks", req, response);
});

apiRoutes.delete('/assignments/:id', function(req, response) {
	handler.handleDeleteRequest("assignments", req, response);
});

app.use('/api', apiRoutes);

app.listen(8081);

console.log('Server running at http://127.0.0.1:8081/');

