//////////////////////////////////////////////////
// GLOBAL MUSICAL PARAMETERS AND SQL VARIABLES
//////////////////////////////////////////////////

//MUSICAL & SQL SETTINGS 
window.saaMidiNote = 60;

//Current notation system. int2notation() will later use this to decide which SQL column to display.
window.notationMode = 0;

//Notation columns from the SQL tables for the various notationMode values
window.notationColumns = [
//"relative_integers", 				//not from a column, just uses the raw int in the SQL data
"hindustaanee_symbol", 				//"sargam" for pitchclasses table
"western_symbol", 
"scale_degree_symbol", 
"carnatic_symbol" 
];

//Limits on range of musical integers translated to svarsthaan
window.lowestMusicalInt = -60;
window.highestMusicalInt = 67;
window.lowestSymbolIDinSQLtable = 100;

//////////////////////////////////////////////////
// DATABASE CONFIGURATION & SQL CLIENT 
//////////////////////////////////////////////////

//Connection details for the Supabase SQL database. The anon key is intentionally public. It only grants whatever permissions have been configured in the Supabase project.
const DATABASE_URL = "https://cxjfqwnmabyabhjhadjy.supabase.co";
const DATABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amZxd25tYWJ5YWJoamhhZGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5Njc2NDUsImV4cCI6MjA3MTU0MzY0NX0.qbI-CU_wgAioBihGx54RXpr4cBryhzIjc4C8iT5YAX0";

//Create 'Client' - courier which talks to SQL database as the browser's representative
window.databaseClient = supabase.createClient(
												DATABASE_URL,
												DATABASE_ANON_KEY
),

////////////////////////////////////////////////////////////////////////////////////////////////////
// CACHED SQL TABLES - These tables are downloaded once and then kept in memory for instant access by every page.
////////////////////////////////////////////////////////////////////////////////////////////////////

// ---------- GENERAL MUSIC DATA ----------
window.pitchclasses = new Map();
window.octaves = new Map();
window.symbols = new Map();
window.tetrachords = new Map();
window.thaats = new Map();

// ---------- RAAG METADATA ----------
window.dimensions = new Map();
window.saa_absence = new Map();
window.angs = new Map();
window.samays = new Map();
window.taanpuraas = new Map();
window.creators = new Map();
window.popularity = new Map();
	
//////////////////////////////////////////////////
// PRECOMPUTED NOTATION
//////////////////////////////////////////////////

//Stores the final notation string for every possible musical integer, including svarsthaan and symbols
//Key = musical integer. Value = final notation string
window.notationMap = new Map();

//Stores the int index of every final notation string in the notationMap, including svarsthaan and symbols
//Key = final notation string. Value = musical integer
window.reverseNotationMap = new Map();

//Stores the midi note playing value for every possible musical integer, based on value of current saaMidiNote
window.midiMap = new Map();
window.reverseMidiMap = new Map();	//REVERSE - Key = absolute MIDI note. Value = svarsthaan int (-60 to +67)

////////////////////////////////////////////////////////////////////////////////////////////////////
// CACHE STATUS - Prevents downloading the same lookup tables multiple times
////////////////////////////////////////////////////////////////////////////////////////////////////

window.musicLoaded = false;
window.raagMetadataLoaded = false;


//////////////////////////////////////////////////
// GENERIC DATABASE FUNCTIONS
//////////////////////////////////////////////////

//FETCH ROWS FROM GIVEN SQL TABLE - Parameters: 1. tableName - SQL table name. 2. columns (Comma-separated list of columns. Default = "*") 3. minID - Lowest id to include. 4. maxID - Highest id to include. 5. sortColumn - Column used for sorting. Default = "id"
window.fetchTable = async function (
	tableName,
	options = {}
)
{
	const {
		columns = "*",  
		minID = null, 
		maxID = null, 
		sortColumn = "id" 
	} = options;

	let query = databaseClient
		.from(tableName)
		.select(columns)
		.order(sortColumn);

	if (minID !== null) {
		query = query.gte("id", minID);
	}

	if (maxID !== null) {
		query = query.lte("id", maxID);
	}

	const { data, error } = await query;

	if (error) {
		throw error;
	}
	
	return data;
};

//GET A SINGLE ROW FROM THE SQL SCALE TABLE
window.getScaleTableRow = async function (rowID) {
	const row = await fetchTable("scales", {minID: rowID, maxID: rowID} );	//columns: "*" not needed, fetchTable defaults to all
	//console.log("getScaleTableRow():", rowID, row);
}

//CACHE GIVEN TABLE AS MAP 
window.cacheTable = async function ( tableName, tableMap, options = {} ) {	//Downloads a lookup table from SQL 
	const rows = await fetchTable(tableName, options);						//and stores it inside one of the cached maps
		
	tableMap.clear();			//Existing contents are cleared first so the same function can later be used to refresh cached data if required
	
	//Store every SQL row in the Map, using its primary-key ID as the lookup key
	for (const row of rows) {
		tableMap.set(row.id, row);
	}

	return tableMap;
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// MUSIC DATA & RAAG METADATA INITIALIZATION + HELPER FUNCTIONS TO GET CACHED TABLE DATA
////////////////////////////////////////////////////////////////////////////////////////////////////

//CACHE ALL GENERIC HELPER TABLES				//tables required by the general music engine. 
window.loadMusicData = async function () 		//This is enough for • notation conversion • thaaT display • pitch calculations
{
	if (musicLoaded) { return; }				

	//load all the helper tables
	await cacheTable("pitchclasses", pitchclasses);
	await cacheTable("octaves", octaves);
	await cacheTable("symbols", symbols);
	await cacheTable("tetrachords", tetrachords);
	await cacheTable("thaats", thaats);
	
	buildNotationMap();							//Build the notation lookup map

	musicLoaded = true;							//set flag
};

//CACHE RAAG-SPECIFIC HELPER TABLES 			
window.loadRaagMetadata = async function () 	//(intentionally separate from the music engine because many pages never need them)
{
	if (raagMetadataLoaded) { return; }			//safety: if it's already loaded, end function

	//load raag-relevant tables
	await cacheTable("dimensions", dimensions);
	await cacheTable("saa_absence", saa_absence);
	await cacheTable("angs", angs);
	await cacheTable("samays", samays);
	await cacheTable("taanpuraas", taanpuraas);
	await cacheTable("creators", creators);
	await cacheTable("popularity", popularity);

	raagMetadataLoaded = true;					//set flag
};

//HELPER FUNCTION TO RETRIEVE CACHED DATA FROM GIVEN SQL TABLE OF GIVEN ROW, OPTIONALLY OF GIVEN COLUMN
window.getCachedTableData = function (tableName, rowID, columnName = null)
{
	const table = window[tableName];
	if (!table) return "ERROR! Given table " + tableName + " not found!";
	
	const row = table.get(rowID);	
	if (!row) return "ERROR! Given row with ID " + rowID + " not found in table " + tableName + " !" ;
	
	if (columnName === null) return row;
	
	return row[columnName];
};

//POPULATE OPTIONS FOR GIVEN 'SELECT' INPUT ELEMENTS FROM GIVEN CACHED TABLE (USING GIVEN COLUMN NAME, IF CALLED WITH 3 PARAMETERS)
window.populateSelectMenu = function (selectHtmlElementID, sourceData, displayNameColumn = "name")
{	
	for ( const row of sourceData.values() ) {
		const option = document.createElement("option")
		option.value = row.id;
		option.textContent = row[displayNameColumn];
		selectHtmlElementID.appendChild(option);
		//console.log("populateSelectMenu for-loop: option.value=", option.value, " option.textContent:", option.textContent);		
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTATION MAP BUIDER, CONVERSION HELPER FUNCTIONS, CHANGING NOTATION DISPLAY
////////////////////////////////////////////////////////////////////////////////////////////////////

//CHANGING / SETTING NOTATION DISPLAY SYSTEM
window.setNotationSystem = function (givenNotationMode) {
	notationMode = givenNotationMode;
	buildNotationMap();
};

//INTEGER TO NOTATION STRING
window.int2notation = function (givenInt) {		
	const notationColumnName = notationColumns[notationMode];	//Calculate notation column number
	
	//Notation symbol int values in sql data start from lowest id value in the symbols SQL table (variable at top)
	if (givenInt >= lowestSymbolIDinSQLtable) {											
		const symbol = getCachedTableData("symbols", givenInt, notationColumnName);		
		if (typeof symbol !== "string") { return "Symbol not returned correctly from cached symbols table!"; }				
		//let i = 0;	i++;	console.log(i, 'givenInteger:', givenInt, 'looked-up string:', symbol);
		return symbol;
	}	
	
	//Calculate row ids for pitchclass and octave tables
	const pitchclassID = ( (givenInt % 12) + 12) % 12;			//Musical Note int values in sql data can run from -60 to +67
	const octaveID = Math.floor(givenInt / 12);					//Octave ids in sql table run from -5 to +6
	
	//Get required value from the relevant row in each of the cached tables
	const pitchclassString = getCachedTableData("pitchclasses", pitchclassID, "sargam");	//SPECIAL CASE FOR PITCHCLASSES TABLE!!!
	const octaveString = getCachedTableData("octaves", octaveID, notationColumnName);
	
	if ( typeof pitchclassString !== "string" || typeof octaveString !== "string") 
	{ 
		return "pitchclassString: " + pitchclassString; //Pitchclass notation string AND/OR octave mark string not returned correctly from cacheds table!
	}
	
	//empty strings for both lower and upper octave symbols to be concatenated
	let lowerOctave = "";
	let upperOctave = "";
	
	//fill the looked-up octave string into the appropriate octave mark field, lower or upper
	if (octaveID < 0) { lowerOctave = octaveString; }
	if (octaveID > 0) { upperOctave = octaveString; }
	
	return lowerOctave + pitchclassString + upperOctave;
}

//MAIN BUILDER FUNCTION TO POPULATE GLOBAL NOTATION MAP
window.buildNotationMap = function () {								// Called after loading the music tables, and whenever notationMode or saaMidiNote are changed. No parameters, no return
	notationMap.clear();											//remove previous contents
	reverseNotationMap.clear();										//remove previous contents
	
	for (let musicalInt = lowestMusicalInt; musicalInt <= highestMusicalInt; musicalInt++)	//svarsthaan population
	{
		const currentNotationString = int2notation(musicalInt);
		notationMap.set( musicalInt, currentNotationString );		//Builds the cached map of the notation strings
		reverseNotationMap.set( currentNotationString, musicalInt );//Builds the cached reverse map of the notation strings
		//console.log('BUILD NOTES! Int is', musicalInt, ' generated string:', currentNotationString);
	}
	
	for (const [symbolID] of symbols)								//symbols population (all rows in cached SQL table)
	{
		const currentNotationString = int2notation(symbolID);
		notationMap.set( symbolID, currentNotationString );			//Builds the cached map of the notation strings
		reverseNotationMap.set( currentNotationString, symbolID );  //Builds the cached reverse map of the notation strings
		//console.log('BUILD SYMBOLS! Int is', symbolID, ' generated string:', currentNotationString);
	}
}

//NOTATION STRING TO INTEGER ARRAY
window.string2intArray = function (givenString) {
	const trimmedString = givenString.trim();
	if (trimmedString === "") {
		logConsole("!!!string2intArray: trimmedString after trim: |" + trimmedString + "| with length:" + trimmedString.length);
		return [];			//EMPTY STRING RETURNS EMPTY ARRAY 
	}
	
	const stringArray = trimmedString.split(/\s+/);	
	//logConsole("2 string2intArray: stringArray after split:" + stringArray + " with length:" + stringArray.length);
	
	const resultArray = [];
	
	for (let i = 0; i < stringArray.length; i++)
	{
		resultArray.push( reverseNotationMap.get( stringArray[i] ) );
		//console.log(i, stringArray[i], resultArray[i], reverseNotationMap.get( stringArray[i] ) );
		
		//ADD ERROR HANDLING ??
	}
	
	//console.log(stringArray, stringArray.length, resultArray, resultArray.length);	
	
	return resultArray;
}

window.intArray2string = function (givenIntArray) {
	//return blank string if array is empty
	if (givenIntArray.length === 0) {
		logConsole("!!!intArray2string: givenIntArray is empty, returning blank string!");
		return "";			//EMPTY EMPTY ARRAY RETURNS STRING 
	}
	
	//logConsole("!!!intArray2string: givenIntArray is VALID");
	
	let resultString = "";
	
	for (let i = 0; i < givenIntArray.length; i++)
	{
		resultString += notationMap.get(givenIntArray[i]);
		if (i < (givenIntArray.length - 1) ) { resultString += " "; }
	}
	//console.log("Converted given int array: [", givenIntArray, "] to resultString:", resultString);		
	
	return resultString;
}

//CLEAN NOTATION STRING - CASE, SPACE, TRIM
window.cleanNotationString = function (givenString) {
	let result = givenString;
	
	result = result.replaceAll("s", "S");
	result = result.replaceAll("p", "P");
	result = result.replace(/\s+/g, " ");
	result = result.trim();
	
	//console.log("Cleaned givenString", "|"+givenString+"|", " to", "|"+result+"|");		
	return result;
}

//RETURN ARRAY OF INVALID NOTATION TOKENS CONTAINED IN GIVEN STRING
window.flagInvalidNotation = function (givenString) {
	let resultArray = [];
	const tokens = givenString.split(' ');
	
	for (const token of tokens) {
		if ( !reverseNotationMap.has(token) ) {
			resultArray.push(token);
			//console.log("flagInvalidNotation():", token, reverseNotationMap.has(token), resultArray );
		}
	}
	return resultArray;
}

//////////////////////////////////////////////////
// PLAYBACK SYSTEM
//////////////////////////////////////////////////

//MIDI PLAYBACK ARRAY SETUP 
window.buildMidiMap = async function (givenRaagID) {
	for (let musicalInt = lowestMusicalInt; musicalInt <= highestMusicalInt; musicalInt++)	//svarsthaan Limits
	{
		const currentMidiNote = musicalInt + saaMidiNote;		//add current MIDI Saa note value
		midiMap.set( musicalInt, currentMidiNote );				//(-60 to +67) Grow global map of absolute midi note values for each musical int 
		reverseMidiMap.set( currentMidiNote, musicalInt );		//(0 to 127 by default) Grow reverse map of absolute midi note value 
		//console.log('BUILD MIDI NOTES! Int:', musicalInt, ' MIDI noteVal:', currentMidiNote);
	}
}

//////////////////////////////////////////////////
// UX AND INTERACTIVE ELEMENT FUNCTIONS
//////////////////////////////////////////////////

//GENERIC ERROR FUNCTION, CREATES ALERT POPUP
function errorAlert(inputElement, errorDetails) {
	const message = 
		'The notation "' + errorDetails + '" is not recognised.\n\n' +
		'Please correct it before continuing.';

	alert(message);

	//inputElement.focus();
}