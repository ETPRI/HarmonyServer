/*
 init widget Table
input - db Object
{
		 label: "people"
		,comment: "this holds people"
		,fields: {
		    nameFirst: {label: "First Name", comment: "given name"}
	     ,nameLast:  {label: "Last Name",  comment: "Sir name"}
			 ,email:     {label: "Last Name",  comment: "Sir name"}
		 }}

output: html widget that allows, disply, search, add, edit on db.

*/


class widgetTable  {
////////////////////////////////////////////////////////////////////
// tableName
// id - for document.getElementById(id)
constructor (tName) {
  // init instance variables
  this.tableName = tName;
  this.idWidget = app.id.get(0); // strings
  this.idLimit  = app.id.get(1);
  this.idHeader = app.id.get(2);
  this.idData   = app.id.get(3);
  this.fields   = app.db[this.tableName].fields;
  this.tbody    = {} ; // init after page is rendered

  // need to hit neo4j db
  this.authToken = neo4j.v1.auth.basic("neo4j", "neo4j");
  this.driver    = neo4j.v1.driver("bolt://localhost", this.authToken, {encrypted:false})
  this.session   = {};


  // build header
  const html =`
  <div id="#0#" class="widget" db="nameTable: #tableName#"><hr><b>
  <input type="button" value="Close"  onclick="app.widget.close(this)"> ` + tName +` </b>
  <input type="button" value="Add"    onclick="app.widget.t('add',this)">
  <input type="button" value="Save"   onclick="app.widget.save(this)">
  <input type="button" value="Search" onclick="app.widget.search(this)">
  <input type="button" value="Colapse" onclick="app.widget.collapse(this)"> limit
  <input id="#1#" value ="9" style="width: 20px;">
  <table>
    <thead id="#2#"> #header# </thead>
    <tbody id="#3#"> </tbody>
  </table>
  <!-- popup goes here -->
  </div>
  `


  const html2 = app.id.replace(html,0);  // replace relative ids with apsolute ides
  const html3 = html2.replace('#tableName#',this.tableName).replace("#header#",
  // create html for header
  (function(fields, idWidget) {
  	// build search part of buildHeader
    let r="<tr>#search#</tr><tr>#fields#</tr>";
      // put in search row
    let s="";
    for (var fieldName in fields) {
        let s1 = '<th><input " db="fieldName: #1"></th>'
        s += s1.replace('#1',fieldName)
  	}

    // append lable part of the header
    let f="";
    for (var propt in fields){
        f += "<th onClick='app.widget.sort(this)'>"+ fields[propt].label + "</th>" ;
  	}
    return r.replace('#search#',s).replace('#fields#',f);
  }) (this.fields, this.idWidget)
  )

  document.getElementById('widgets').innerHTML =
    html3 + document.getElementById('widgets').innerHTML;

  this.tbody = document.getElementById(this.idData);

  // do search with no criteria, limit to match records
  this.search();
}


////////////////////////////////////////////////////////////////////
search() { // public - call when data changes
	// delete previous results from page <thead><tr><th><input>
  //                                   <tbody>
	this.tbody.innerHTML = "";  // used in onNext

  let query =  app.db[ this.tableName ].cypher.query;
  this.session   = this.driver.session();
  if (typeof(query) === 'undefined') {
    // default query was not specifed, generat one from user search criteria
    query = this.buildQuery();
  }

	// put query on html page for debugging
	document.getElementById('debug').value = query;
    this.session.run(query, {}).subscribe(this);
  // added onNext and onCompleted methods for neo4j to call
  //  app.neo4j.session.run(query, {}).subscribe(this);
}


////////////////////////////////////////////////////////////////////
buildQuery() { // public - called when seach criteria changes
  // init cypherQuery data
  let match    = "(n:"+ this.tableName  +")";
  let where    = this.buildWhere();
  let orderBy  = "n." + app.db[ this.tableName ].cypher.orderBy;
  let limit    = document.getElementById(this.idLimit).value;

  let query =
	    "match "  + match
		+ (function(w){if(0<w.length) return " where "  + w + " "; else return " ";})(where)
		+ "return "+ this.buildReturn() + " "
		+ (function(o){if(0<o.length) return " order by "+ o + " "; else return " ";}) (orderBy)
		+ (function(l){if (l.trim === "") return ""; else return " limit " + l}) (limit);

  return query;
}


////////////////////////////////////////////////////////////////////
// called by neo4j for each record returned by query
onNext(record) {
  // On receipt of RECORD
  let html = `<tr>`
  //	app.widgetTable.add(tr,"td",document.createTextNode(++recordCount)); // add record count to first colum of table
  let i=0;
  for (let fieldName in this.fields) {
    html += '<td ' + this.getatt(fieldName) +'>'+ record.get(i++) +"</td>" ;
  }

  this.tbody.innerHTML += html +"</tr>";
}

getatt(fieldName){
  let ret = this.fields[fieldName].att
  if (!ret) {
    ret="";
  }

  return (ret);
}


////////////////////////////////////////////////////////////////////
// called by neo4j after the query has run
onCompleted(metadata){
  // could get some interesting info on query running
  this.session.close();
//  debugger;
}


buildReturn(){
  // output - n.fieldName1, n.fieldName2 ...

  let r="";

  for (let fieldName in this.fields)
    {r += "n."+ fieldName + ", "}
  return (r.substr(0, r.length-2));
}


buildWhere() {
//neo4j.where = (function(idHeader,getAtt) {
  /*
  input - search element that changed
  output - nameLast =~"(?i)Bol.*"
  */  // <tr><th><input>  must go up 2 levels to get to tr
  const th  = document.getElementById(this.idHeader).firstElementChild.children; // get collection of th
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

edit(domElement) {
  // edit row - move values from click to input nextElementSibling
  let th = document.getElementById(this.idHeader).firstElementChild.firstElementChild;
  while(domElement){
    th.firstElementChild.value = domElement.textContent;
    domElement=domElement.nextElementSibling;
    th = th.nextElementSibling;
  }

}

add() {
  // CREATE (:person {name:'David Bolt', lives:'Knoxville'})
  let th  = document.getElementById(this.idHeader).firstElementChild.firstElementChild;

  const create = "create (:"+ this.tableName +" {#data#})";
  let data="";
  while (th) {
    let inp = th.lastElementChild;



    data += this.getAtt(inp,"fieldName") +":'" + inp.value +"', ";
    th=th.nextElementSibling;
  }

  let query = create.replace("#data#", data.substr(0,data.length-2) );
  document.getElementById('debug').value = query;

  this.session.run(query, {}).subscribe(this);
}

////////////////////////////////////////////////////////////////////
addEditForm() { // public - build table header

let html =
`
<div>
<br>
<input type="button" value="Close"   onclick="app.widget.popUpClose(this)">
<input type="button" value="save"    onclick="app.widget.popUpSave(this)">
<table>
#tr#
</table>
</div>
`

// pop up addEditForm
let s="";
for (var fieldName in this.fields) {
    let s1 = '<tr><th>' + this.fields[fieldName].label + '</th><td><input db="'+ fieldName +'"></td></tr>'
//    s += s1.replace('#1',fieldName)
     s += s1;
}

document.getElementById(this.idWidget).innerHTML +=
  html.replace("#tr#", s);
}


saveForm(domElement) { // public - build table header
  // CREATE (:person {name:'David Bolt', lives:'Knoxville'})
  let tr  = domElement.parentElement.lastElementChild.firstElementChild.firstElementChild;

  const create = "create (:"+ this.tableName +" {#data#})";
  let data="";
  while (tr) {
    let inp = tr.lastElementChild.firstElementChild;

    data += inp.getAttribute("db") +":'" + inp.value +"', ";
    tr=tr.nextElementSibling;
  }


  let query = create.replace("#data#", data.substr(0,data.length-2) );
  document.getElementById('debug').value = query;

  this.session.run(query, {}).subscribe(this);
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

} ///////////////////////////////////// end class
