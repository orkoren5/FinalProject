var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var jwt = require('jsonwebtoken');

var sUrl = 'mongodb://localhost:27017/homie';
function getColName(sEntityName) {
	return sEntityName;
}

function checkValidity(sEntityName, oObject, sForeignIds) {
	delete oObject["_id"];
	if (sForeignIds) {
		var fields = sForeignIds.split(",");
		for (var i = 0; i < fields.length; i++) {
			var value = oObject[fields[i]];
			if (value && typeof(value) === "string") {
				oObject[fields[i]] = convertHexToObjectID(value);
			} else if (value && Array.isArray(value)) {
				for (var j = 0; j < value.length; j++) {
					oObject[fields[i]][j] = convertHexToObjectID(value[j]);
				}
			}
		}
	}
	return true;
}

function convertHexToObjectID(sHex) {	
	try {
		return ObjectID.createFromHexString(sHex);
	} catch (err) {
		return null;
	}
}

function parseQueryAndReturnFilters(query) {
	var filters = {};

	for (var key in query) {
		if (key.charAt(0) === "$") {
			filters[key] = query[key];
			delete query[key];
		}
	}

	parseQueryStep(query);
	parseQueryStep(filters);
	return filters;
}

function parseQueryStep(query) {
for (var key in query) {
		var value = query[key];

		if (query.mongoFilters && key.charAt(0) === "$") {
			query.mongoFilters[key] = value
			delete query[key];
			break;
		}

		if (typeof(value) === "string") {

			// Cast a number  		
			if (!isNaN(value)) {
				query[key] = value*1;
			}
			
			// Cast ObjectID
			if (ObjectID.isValid(value)) {
				query[key] = convertHexToObjectID(value);
			}
			
			// Cast a boolean  		
			if (value === "true") {
				query[key] = true;
			} else if (value === "false") {
				query[key] = false;
			}

			// Case an array
			var arr = value.split(",");
			if (arr.length > 1) {
				query[key] = {
					"$in" : parseQueryStep(arr)
				}
			}
		}
	};
	return query;
}

function clone(obj) {
    if (!obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

var handleLoginRequest = function(oUser, secretKey, responseStream) {
		MongoClient.connect(sUrl, function(err, db) {
		var col = db.collection("users");
		col.findOne({name: oUser.name}, function(err, user) {
			if (err) 
				throw err;
		    if (!user || user.password != oUser.password) {
		      responseStream.json({ success: false, message: 'Authentication failed. Incorrect username or password.' });
		    } else {

		        // create a token
		        var token = jwt.sign(user, secretKey, {
		          expiresIn: "24h" // expires in 24 hours
		        });		
		        responseStream.json({
		          success: true,
		          user: user,
		          message: 'Enjoy your token!',
		          token: token
		        });
	      	}
	      	db.close();
	  	});
	});
};

var handleSignUpRequest = function(oUser, secretKey, responseStream) {
	MongoClient.connect(sUrl, function(err, db) {	
		var col = db.collection("users");
		if (checkValidity("users", oUser)) {
			oUser.courseIds = [];
			oUser.assignmentIds = [];
			col.insertOne(oUser, function(err, result) {

				 // create a token
		        var token = jwt.sign(oUser, secretKey, {
		          expiresIn: "24h" // expires in 24 hours
		        });		    
		        responseStream.json({
		          success: true,
		          message: 'Enjoy your token!',
		          token: token
		        });
			    db.close();
			});
		}	
	});
};

var handleGetByIdRequest = function(sEntityName, sId, responseStream) {
	var colName = getColName(sEntityName);
	MongoClient.connect(sUrl, function(err, db) {
		var col = db.collection(colName);
		col.findOne({_id: convertHexToObjectID(sId)}, function(err, item) {
			responseStream.json(item);
		    db.close();
	  	});
	});
};

var handleGetRequest = function(sEntityName, req, responseStream) {
	var colName = getColName(sEntityName);
	var query = req.query;
	MongoClient.connect(sUrl, function(err, db) {
		var col = db.collection(colName);
		if (Object.getOwnPropertyNames(query).length === 0) {
			query.owner = req.user._id.toString();
		}
		var filters = parseQueryAndReturnFilters(query);
		var cursor = col.find(query);
		if (filters["$skip"]) {
			cursor.skip(filters["$skip"]);
		}
		if (filters["$top"]) {
			cursor.limit(filters["$top"]);
		}
		cursor.toArray(function(err, items) {
			responseStream.json(items);
		    db.close();
	  	});
	});
};

var _handleGetRequestWithAggregation = function(sEntityName, req, responseStream, fnCleanOutput) {
	var colName = getColName(sEntityName);
	var query = req.query;
	var aggregattion = req.aggregation;
	var filters = parseQueryAndReturnFilters(query);
	if (filters["$skip"]) {
		aggregattion.unshift({"$skip": filters["$skip"]});
	}
	if (filters["$top"]) {
		aggregattion.unshift({"$limit": filters["$top"]});
	}
	aggregattion.unshift({ "$match": query });
	MongoClient.connect(sUrl, function(err, db) {
		var col = db.collection(colName);
		if (Object.getOwnPropertyNames(query).length === 0) {
			query.owner = req.user._id.toString();
		}
		console.log(req.query);
		col.aggregate(aggregattion).toArray(function(err, items) {
			var retItems = items;
			if (fnCleanOutput && typeof(fnCleanOutput) === "function") {
				retItems = fnCleanOutput(items);
			}
			responseStream.json(retItems);
		    db.close();
	  	});
	});
};

var handleGetCoursesByUserId = function(req, responseStream) {
	req.aggregation = [
		{"$limit": 1},
		{"$unwind": "$courseIds"},
		{"$lookup": {
			from: "courses", 
			localField: "courseIds", 
			foreignField: "_id", 
			as: "courses"
		}},
		{"$project": {"name":1, "courses": { "$arrayElemAt": [ "$courses", 0 ] }}},
		{"$group": {
			"_id": "$_id",
			"name": {$first: "$name"},
			"courses": {$push: "$courses"}
		}}
	];
	req.query["_id"] = convertHexToObjectID(req.query.userId);
	delete req.query["userId"];
	_handleGetRequestWithAggregation("users", req, responseStream, function(items) {
		if (items.length > 0) { 
			return items[0].courses
		}
		return [];
	});
}

var handleGetAssignmentsRequest = function(req, responseStream) {
	req.aggregation = [
		{"$unwind": "$users"},
		{"$lookup": {
			from: "users", 
			localField: "users", 
			foreignField: "_id", 
			as: "userObjects"
		}},
		{"$project": {"courseNumber":1,"number":1,"deadline":1,"daysAssessment":1,"owner":1,"userObjects": { "$arrayElemAt": [ "$userObjects", 0 ] }}},
		{"$group": {
			"_id": "$_id",
			"courseNumber": {$first: "$courseNumber"},
			"number": {$first: "$number"},
			"deadline": {$first: "$deadline"},
			"daysAssessment": {$first: "$daysAssessment"},
			"owner": {$first: "$owner"},
			"userObjects": {$push: "$userObjects"}
		}},
		{"$project": {"userObjects.password": 0, "users": 0, "userObjects.groupIds": 0, "userObjects.assignmentIds": 0}},
		{"$lookup" : {
			from: "tasks", 
			localField: "_id", 
			foreignField: "assignmentId", 
			as: "tasks"
		}}
	];

	req.query["users"] = convertHexToObjectID(req.user._id);

	_handleGetRequestWithAggregation("assignments", req, responseStream);
}

var handlePostRequest = function(sEntityName, req, responseStream) {
	var oObject = req.body;
	var sForeignIds = req.headers["homie-foreign-ids"];
	var colName = getColName(sEntityName);
	MongoClient.connect(sUrl, function(err, db) {	
		var col = db.collection(colName);
		if (checkValidity(colName, oObject, sForeignIds)) {
			oObject.owner = req.user._id.toString();			
			col.insertOne(oObject, function(err, result) {
				if (responseStream) {
					responseStream.send(oObject._id.toString());
				}
				console.log(oObject._id);
			    db.close();
			});
		}	
	});
};

var handlePostAssignmentsRequest = function(req, responseStream) {

	var clonedReq = {
		body: clone(req.body),
		headers: clone(req.headers),
		user: clone(req.user)
	};

	delete req.body["users"];
	req.body.global = true;
	handlePostRequest("assignments", req);

	clonedReq.body["users"] = [ convertHexToObjectID(clonedReq.user._id) ]; // Add self to users list
	handlePostRequest("assignments", clonedReq, responseStream);
};

var handlePutRequest = function(sEntityName, req, responseStream) {
	var oFieldsToUpdate = req.body,
		colName = getColName(sEntityName);
		sObjectId = req.params.id,
		sForeignIds = req.headers["homie-foreign-ids"];
	MongoClient.connect(sUrl, function(err, db) {	
		var col = db.collection(colName);
		if (checkValidity(colName, oFieldsToUpdate, sForeignIds)) {
			col.update({_id: convertHexToObjectID(sObjectId)}, {
				$set: oFieldsToUpdate,
				$currentDate: { "lastModified": true }
			},	function(err, result) {
				if (!err) {
					var message = result.result.nModified > 0 
						? "Object was modified successfully" 
						: "Object modification failed - object ID does not exist";
					var status = result.result.nModified > 0 ? 200 : 400;
					responseStream.status(status).send(message);
					console.log(status + ": " + message);
				} else {
					console.log(err.message);
				}				
			    db.close();
			});
		}	
	});
};

var handleDeleteRequest = function(sEntityName, req, responseStream) {
	var colName = getColName(sEntityName),
		sObjectId = req.params.id,
		sOwnerId = req.user._id.toString();
	MongoClient.connect(sUrl, function(err, db) {	
		var col = db.collection(colName);
		col.remove({_id: convertHexToObjectID(sObjectId), owner: sOwnerId},	function(err, result) {
			var message = result.result.n > 0 
				? "Object was deleted successfully" 
				: "Object deletion failed - object ID does not exist";
			var status = result.result.n > 0 ? 200 : 400;
			responseStream.status(status).send(message);
			console.log(status + ": " + message);
		    db.close();
		});		
	});
};

var handlePostAddOrDeleteUserToAssignment = function(req, responseStream) {
	var oFields = req.body,
		sObjectId = req.params.id;
	MongoClient.connect(sUrl, function(err, db) {
		var col = db.collection("users");
		col.findOne({"name" : oFields.name}, function(err, item) {
			if (!item) {
				responseStream.status(400).send("user " + oFields.name + " doesn't exit");
		    	db.close();
			} else {
				var updateParam = oFields.isAdd ? {"$addToSet" : {"users" : item._id}} : {"$pull" : {"users" : item._id}};
				db.collection("assignments").update({"_id" : convertHexToObjectID(sObjectId)}, updateParam, function (err, result) {
					var message = result.result.n > 0 
						? "User was deleted successfully" 
						: "User addition failed - assignment ID does not exist";
					var status = result.result.n > 0 ? 200 : 400;
					responseStream.status(status).send(message);
					console.log(status + ": " + message);
					db.close();
				});
			}		
	  	});
	});
}

exports.handleGetByIdRequest = handleGetByIdRequest;
exports.handleGetRequest = handleGetRequest;
exports.handleGetAssignmentsRequest = handleGetAssignmentsRequest;
exports.handlePostRequest = handlePostRequest;
exports.handlePostAssignmentsRequest = handlePostAssignmentsRequest;
exports.handlePutRequest = handlePutRequest;
exports.handleDeleteRequest = handleDeleteRequest;
exports.handleLoginRequest = handleLoginRequest;
exports.handleSignUpRequest = handleSignUpRequest;
exports.handlePostAddOrDeleteUserToAssignment = handlePostAddOrDeleteUserToAssignment;
exports.handleGetCoursesByUserId = handleGetCoursesByUserId;








