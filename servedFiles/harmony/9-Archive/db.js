/*
Event though this is a graph database I'm haveing trouble keeping RDBS and neo4j terminogy straight

I will stick  RDBS terminogy inside the program

RDBS       neo4j

db           db - collection of storted data
table        a query can return what looks like a tabe, yet it a collecion of nodes
records     node  (lable is the type of node)
fields      Keys

I will use table to mean the collection of nodes that have a similar structure.

future plan is to migrate all this data to db, read it out in the beginig of each session


*/


// define the people screen
app.db.people = {
	 nameTable: "people"     //
	,comment: "each record (node) holds one person"
	,cypher:   {orderBy: "nameLast"}  // default cypher query componest
 	,fields: {
	//  	"id(n)":   {label: "ID"        , comment: "node id",  att: 'onclick="app.widget.edit(this)"' }
      nameFirst: {label: "First Name", comment: "given name",  att: 'onclick="app.widget.edit(this)"'}
	   ,nameLast:  {label: "Last Name" , comment: "Sir name", }
		 ,email:     {label: "email"     , comment: "primary email"}  // should remove at someponit
	 }}
// at some point relations will point to address, phone numbers, email text etc

// :2018-01-12: pulling data from query and building html page, need to move to
// putting all  data into an object and render from the object - below is proposed structure

app.db.peopleNew = {
	// from meta data query,
	nameTable: "people"     //
 ,comment: "each record (node) holds one person"
 ,cypher:   {query: "", orderBy: "nameLast"}  // default cypher query componest
 ,fields: {
		 nameFirst: {label: "First Name", comment: "given name",  att: 'onclick="app.widget.edit(this)"'}
		,nameLast:  {label: "Last Name" , comment: "Sir name",    }
		,email:     {label: "email"     , comment: "primary email"}  // should remove at someponit
	}

  // user can change this while widge is runing
	,columOrder:   ["nameLast", "nameFirst", "email"]
  ,displayOrder: ["nameLast"]   // sort by

	// data from query
	,data: [
		 {id: "34" ["data", "asdfsd", "sadfs", "asdf"], changed: "true"}
		,{id: "1"  ["data", "asdfsd", "sadfs", "asdf"], }
		,{id: "42" ["data", "asdfsd", "sadfs", "asdf"], }
	]
	}

/*
 = {
	 nameTable: "person"     //
	,comment: "each record (node) holds one person"
	,cypher:   {orderBy: "nameLast"}  // default cypher query componest
 	,fields: {
		 "id(n)":   {label: "ID"        , comment: "node id",  att: 'onclick="app.widget.edit(this)"' }
	  ,nameFirst: {label: "First Name", comment: "given name"}
		,name:      {label: "Name"      , comment: "-"}
   ,nameLast:   {label: "Last Name" , comment: "Sir name"}
	 }}
*/



/*
app.db.address = {
	 nameTable: "address"
	,comment: "phical address"
	,cypher:      {orderBy: "nameLast"}
	,fields: {
	    street:  {label: "Street"  , comment: "includes #"}
	   ,city:    {label: "City"    , comment: ""}
		 ,state:   {label: "State"   , comment: ""}
		 ,country: {label: "Country" , comment: ""}
	 }}
*/
// add def ofr phone, internet, organizations, etc


///////////////////////////// these are info on db, not really tables
app.db.nodes = {
	 nameTable: "nodes"
	,comment: "node in db"
	,cypher:   {query: "MATCH (n) unwind labels(n) as L RETURN  distinct L, count(L)"}
	,fields: {
	    "distinct L as L": {label: "Lables", comment: "given name", att: 'onclick="app.widget.click(this)"' }
	   ,"count(L)":        {label: "Count" , comment: "Sir name"  }
	 }}

app.db.keys = {
	 nameTable: "keys"
	,comment: "like fieldnames in RDBS"
	,cypher: {query: "MATCH (p) unwind keys(p) as key RETURN  distinct key, labels(p),  count(key)  order by key"}
	,fields: {
	    key:                   {label: "Key"   , comment: "like fields"}
		 ,"distinct labels(p)":  {label: "Node"  , comment: "Like a table in RDBS"}
		 ,"count(n)":            {label: "Count" , comment: ""}
	 }}

app.db.relations = {
	nameTable: "relations"
	,comment: "like like links in RDBS"
	,cypher: {query: "MATCH (a)-[r]->(b)  return distinct labels(a), type(r), labels(b), count(r)  order by type(r)"}
	,fields: {
	  "distinct labels(a)":  {label: "Node"        , comment: "Like a table in RDBS"}
	 ,"type(r)":             {label: "-Relation->" , comment: "like fields"}
	 ,"labels(b)":           {label: "Node"        , comment: ""}
	 ,"count(r)":            {label: "Count"       , comment: ""}
	}}


app.db.onCompleted = function (metadata) {
  // could get some interesting info on query running
  this.session.close();
//  debugger;
}
