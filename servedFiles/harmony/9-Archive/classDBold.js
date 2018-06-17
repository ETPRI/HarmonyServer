
//////////////////////////////////////////////
class db  {

constructor (tableName) {
	this.tableName = tableName;
	this.template  = app.db[tableName];
	this.query     = "";
	this.data      = {};
}

////////////////////////////////////////////////////////////////////
buildQuery(inputFirst) { // public - called when seach criteria changes
	let query = app.db[this.tableName].cypher.query;

	if (query) {
		this.query = query;
		return;
	}

  // init cypherQuery data
  let match    = "(n:"+ this.tableName  +")";
  let where    = this.buildWhere(inputFirst);
  let orderBy  = "n." + app.db[ this.tableName ].cypher.orderBy;
//  let limit    = document.getElementById(this.idLimit).value;

 query =
	    "match " + match
		+ (function(w){if(0<w.length) return " where "  + w + " "; else return " ";})(where)
		+ "return n" //+ this.buildReturn() + " "
		+ (function(o){if(0<o.length) return " order by "+ o + " "; else return " ";}) (orderBy)
		+ "limit 10" //		+ (function(l){if (l.trim === "") return ""; else return " limit " + l}) (limit)
		;

  this.query = query;
}

////////////////////////////////////////////////////////////////////
runQuery (widget) {
	// bring data from db into memory structur
	this.session  = app.driver.session();
	this.data = [];
	// build data structure
	document.getElementById('debug').value = this.query;
	this.widget = widget;
	this.session.run(this.query, {}).subscribe(this);
	// added onNext and onCompleted methods for neo4j to call
	//  app.neo4j.session.run(query, {}).subscribe(this);
}

////////////////////////////////////////////////////////////////////
// called by neo4j for each record returned by query
onNext(record) {
  // On receipt of RECORD
  //	app.widgetTable.add(tr,"td",document.createTextNode(++recordCount)); // add record count to first colum of table
	if (1 < record.length) {
		// assume a list of things was returned, so put it in an object to push
		let obj={};
		for (let i=0; i< record.length; i++) {
			obj[record.keys[i]]=record._fields[i];
		}
		this.data.push(obj);
	} else {
		// assume a single object was returned, like return n;
		this.data.push(record["_fields"][0].properties);
	}
}



////////////////////////////////////////////////////////////////////
// called by neo4j after the query has run
onCompleted(metadata){
  // could get some interesting info on query running
//  debugger;
	this.session.close();
	this.widget.buildData();
}

onError() {

}

////////////////////////////////////////////////////////////////////
buildWhere(inputFirst) {
//neo4j.where = (function(idHeader,getAtt) {
  /*
  input - search element that changed
  output - nameLast =~"(?i)Bol.*"
  */  // <tr><th><input>  must go up 2 levels to get to tr
  const th  = inputFirst; // get collection of th
  let where = "";
  // iterrate siblings of input
  for(let i=0; i<th.length; i++) {
    let input = th[i].firstElementChild;
    if (0<input.value.length) {
      where += "n."+ this.getAtt(input,"fieldName") +'=~"(?i)' + input.value +'.*" and ';
    }
  }
  return (where.substr(0, where.length-5)) ;
}

////////////////////////////////////////////////////////////////////
getAtt(element,attName) { // private -----------
	/*
  input - element - is DOM input Object
          attName - name of attribute in db
  return - attribute value from db
	*/
  const ret = element.getAttribute("db").split(attName+":")[1].split(";")[0].trim();
	return(ret);
}

////////////////////////////////////////////////////////////////////
buildReturn(){
  // output - n.fieldName1, n.fieldName2 ...

  let r="";

  for (let fieldName in this.fields)
    {r += "n."+ fieldName + ", "}
  return (r.substr(0, r.length-2));
}

////////////////////////////////////////////////////////////////////
sort () {}


///////////////////////////// these are info on db, not really db tables

}
