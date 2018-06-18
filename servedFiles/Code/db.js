//////////////////////////////////////////////
// This class handles all the communication with the database.
// Currently, other classes write queries which this class executes.
// The plan is to change that so that we could switch databases and only have to change this class.
class db  {
constructor () {
	this.query        = ""; // complete Cypher query string

	this.object       = {};  // call back object
	this.objectMethod = "";  // call back method

	this.session      = {};  // provided by app
	this.data         = [];	 // data recieved from a database query
	this.args = [];					 // arguments to send to call back method
}

// Stores a query in the object to be executed later
setQuery(query) {
	this.query = query;
}


////////////////////////////////////////////////////////////////////
// Executes a query and subscribes to the results. Stores an object, a method in that object, and a list of arguments.
// When the query is complete, the data and any additional arguments that were given will be passed to that method in that object.
// The user doesn't have to pass in any of the arguments. If object and objectMethod aren't given, no method will be called.
// If args aren't given but object and objectMethod are, the method will be called with only the data as an argument.
runQuery (object, objectMethod, ...args) { // call widget, with widgetMethod when query is done
	if (object) {
		this.object       = object;
	}
	else {
		this.object				=	null;
	}

	if (objectMethod) {
		this.objectMethod = objectMethod;
	}
	else {
		this.objectMethod = null;
	}

	this.session      = app.driver.session();
	this.data = []; // this.data starts out as an empty array. onNext will fill it up.
	this.args = args;

 // Shows the query being run in the debug text box of the website. Probably won't be in the finished product.
 const debug = document.getElementById('debug');
	if (debug) {
		debug.value = this.query;
	}

	// Actually run the query and subscribe to the results.
	this.session.run(this.query, {}).subscribe(this);
}


////////////////////////////////////////////////////////////////////
// called by neo4j for each record returned by query. For each record returned,
// creates an object, stores all data returned for that record in that object, and pushes the object to the data array.
onNext(record) {
	const obj={};
	for (let i=0; i< record.length; i++) {
		obj[record.keys[i]]=record._fields[i];
		}
	this.data.push(obj);
}


////////////////////////////////////////////////////////////////////
// called by neo4j after the query has run. Closes the session and passes the data to the callback method.
onCompleted(metadata){
  // Not using metadata right now, but could get some interesting info on query running
	this.session.close();
	// let widget have the data
	if (this.object && this.objectMethod) { // Should just be ignored if no object and method are passed in
		this.object[this.objectMethod](this.data, ...this.args);
	}
}


// need to find all call back methods of session run and do stuff
////////////////////////////////////////////////////////////////////
// called by neo4j after the query has run, if it produced an error.
// Reports the error that was returned and the query that caused it.
onError(err) {
	alert("error db.js-"+err+". Original query: "+this.query)
}

} ///////////////////////////// end of class db
