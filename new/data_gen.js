//////////////////////////////////////////////////
//DOM REFERENCES
//////////////////////////////////////////////////

//User input elements
const nameInput = document.getElementById("nameInput");
const aarohInput = document.getElementById("aarohInput");
const avarohInput = document.getElementById("avarohInput");
const make1Dbutton = document.getElementById("make1Dbutton");
const calculateSaaAbsenceButton = document.getElementById("calculateSaaAbsenceButton");
const dimensionInput = document.getElementById("dimensionInput");
const angIDInput = document.getElementById("angIDInput");
const creatorIDInput = document.getElementById("creatorIDInput");

//Buttons
const storeButton = document.getElementById("storeButton");
const calculateButton = document.getElementById("calculateButton");
const validateButton = document.getElementById("validateButton");
const outputButton = document.getElementById("outputButton");

//Display elements
const raagInfo = document.getElementById("raagInfo");
const errorsDisplay = document.getElementById("errorsDisplay");
const consoleMonitor = document.getElementById("consoleMonitor");
const output = document.getElementById("output");


//////////////////////////////////////////////////
//CREATE RAAG OBJECT FROM CLASS
const currentRaag = new Raag();
//////////////////////////////////////////////////


//////////////////////////////////////////////////	//calling notation: notationMap.get(givenInt);	
//FUNCTIONS											//calling int: reverseNotationMap.get(givenString); 
//////////////////////////////////////////////////  //calling setNotationSystem(0);

//PAGE INITIALIZATION
async function initializePage() {	
	createRaagDisplayTable();
	
	await loadMusicData();	
	//console.log("Loaded Music Data. notationMap size:", notationMap.size, "  -60 = " + notationMap.get(-60) + " 67 = " + notationMap.get(67) + " 100 =", "|"+notationMap.get(100)+"|", " 106 = " + notationMap.get(106) );	
	
	await loadRaagMetadata();	
	//console.log("Loaded Raag Metadata.", angs.get(1) );	
	
	await buildMidiMap();
	//console.log("Built midiMap. midiMap size:" + midiMap.size + "   Int -60 = " + midiMap.get(-60) + "  Int 67 = " + midiMap.get(67) + " Saa = " + midiMap.get(0) );	
		
	populateSelectMenus();
	//console.log("Populated select menus.");
	
	console.log("Page Fully Loaded" );
}
initializePage();

//PUPULATE ALL SELECT ELEMENT OPTION MENUS THAT DEPEND ON CACHED SQL TABLES
function populateSelectMenus() {
	const selectElements = document.querySelectorAll("select");
	
	for (const selectElement of selectElements) {
		const tableName = selectElement.dataset.table;
		const displayColumn = selectElement.dataset.displayColumn ??"name";
		
		if (!tableName) {
			console.log("populateSelectMenus(): Select element \"" + selectElement.id + "\" has no dataTable attribute!");
			continue;
		}
		
		const sourceData = window[tableName];
		
		if (!sourceData) {
			console.log("populateSelectMenus(): Cached table \"" + tableName + "\" does not exist in the cache!");
			continue;
		}
		
		populateSelectMenu(selectElement, sourceData, displayColumn);
		//console.log("Populated", selectElement.id, "from table", tableName)
	}	
	
	//console.log("Finished populateSelectMenus execution");
}

//MAKE 1D - fill Avaroh automatically, disable option '1' in dimension select menu
function make1D() {
	//logConsole();	
	const reverseAarohArray = string2intArray(aarohInput.value).reverse();
	const generatedAvarohString = intArray2string(reverseAarohArray); //string2intArray(aarohInput.value).reverse() //.join('');
	
	logConsole("Running make1D()..." + " reverseAarohArray: " + reverseAarohArray + " generatedAvarohString: |" + generatedAvarohString + "|");
	
	avarohInput.value = generatedAvarohString;
	dimensionInput.value = 1;
}

//////////////////////////////////////////////////
//OUTPUT CALCULATION & DISPLAY (FROM INPUT ELEMENTS)
//////////////////////////////////////////////////

//HELPER TO GET (RECOGNIZE) THE HTML OUTPUT ELEMENT CORRESPONDING TO THE GIVEN CLASS PROPERTY
function getOutputElement(propertyName) {
	return document.getElementById(propertyName + "Output");
}

function rawToFinalInput(inputElement) {
	const propertyName = inputElement.id.replace(/Input$/, "");
	
	switch (propertyName) {
		case "name":
			return inputElement.value.trim();
			
		case "aaroh":
		case "avaroh":			
			const cleanedString = cleanNotationString(inputElement.value);
			//console.log("Cleaned input is:", cleanedString);
			inputElement.value = cleanedString;			
			return string2intArray(cleanedString);
			
		default: 
			return inputElement.value;
	}
}

//MAIN OUTPUT DISPLAY FOR GIVEN RAAG-CLASS PROPERTY
function displayCalculatedOutput(inputElement) {
	const propertyName = inputElement.id.replace(/Input$/, "");
	const outputElement = getOutputElement(propertyName);
	
	//outputElement.textContent = JSON.stringify( string2intArray(inputElement.value) );
	outputElement.textContent = rawToFinalInput(inputElement);
	console.log("displayCalculatedOutput:", outputElement.id, ": |"+outputElement.textContent+"|, converted from input:", "|"+inputElement.value+"|" );	
} 

//GETTING SCALE ROWS FOR AAROH AND AVAROH
const aarohScaleRow = getScaleTableRow(2741);
const avarohScaleRow = getScaleTableRow(1451);
const svarsetScaleRow = getScaleTableRow(4095);

//////////////////////////////////////////////////
//READING AND STORING CURRENT RAAG PROPERTIES
//////////////////////////////////////////////////

//HELPER TO GET (RECOGNIZE) THE HTML INPUT ELEMENT CORRESPONDING TO THE GIVEN CLASS PROPERTY
function getInputElement(propertyName) {
	return document.getElementById(propertyName + "Input");
}

//HELPER TO READ THE CURRENT VALUE IN THE GIVEN HTML ELEMENT 
function getInputValue(inputElement) {
	return inputElement.value;
}

//MAIN FUNCTION TO UPDATE PROPERTY VALUES OF currentRaag CLASS INSTANCE TO MATCH PAGE VALUES TYPED BY USER
function updateCurrentRaag() {
	for (const property in currentRaag) {
		const inputElement = getInputElement(property);
		if (inputElement === null) {
			//console.log("updateCurrentRaag Property", property, "- has no inputElement!");
			continue;
		}
		//console.log("updateCurrentRaag Property", property, ": inputElement found.");
		currentRaag[property] = getInputValue(inputElement);
	}
}

/*UPDATE currentRaag OBJECT AT EVERY KEY-PRESS BY USER IN RAAG INFO FIELDS
function updateCurrentRaag() {	
	currentRaag.setName(nameInput.value);
	currentRaag.setAaroh(aarohInput.value);	
	currentRaag.setAvaroh(avarohInput.value);	
	currentRaag.setDimension(dimensionInput.value);	
	currentRaag.setHumanData(creatorIDInput.value);	
	
	logConsole("updateCurrentRaag:" + currentRaag.name + currentRaag.aaroh + "|" + currentRaag.avaroh);
}*/

//STORE EVERYTHING IN INPUT FIELDS TO CURRENT RAAG OBJECT
function storeCurrentRaagData() {
	logConsole("Running storeCurrentRaagData()...");
	updateCurrentRaag();
	displayRaagInfo();
}

//CALCULATE EVERYTHING FROM GIVEN RAAG INFO
function calculateCurrentRaagData() {
	logConsole("Running calculateCurrentRaagData()...");	
	updateCurrentRaag();
	displayRaagInfo();
}

//VALIDATE ALL RAAG INFO IN USER FIELDS (GLOBAL)
function validateCurrentRaagData() {
	logConsole("Running validateCurrentRaagData()...");	
	
	
	displayErrors();
}

//VALIDATE NOTATION IN GIVEN INPUT ELEMENT (SPECIFIC, HELPER)
function validateNotationInputElement(givenInputElement) {
	const invalidInputTokensArray = flagInvalidNotation(givenInputElement.value);
	//console.log("Invalid Tokens:", invalidInputTokensArray.length, invalidInputTokensArray);
	
	if (invalidInputTokensArray.length != 0) {
		errorAlert(inputElement, invalidInputTokensArray);
		console.log("Called errorAlert with errorDetails:", invalidInputTokensArray); 
		return null;
	}	
}

//OUTPUT INSERT COMMAND FOR CURRENT RAAG
function outputCurrentRaagData() {
	logConsole("Running outputCurrentRaagData()..."); 
	displayOutput();
}

//DEBUGGER
function logConsole(message) {
	consoleMonitor.textContent += message + "\n";
}

//////////////////////////////////////////////////
//EVENT LISTENERS
//////////////////////////////////////////////////

//BUTTONS
make1Dbutton.addEventListener("click", make1D);
storeButton.addEventListener("click", storeCurrentRaagData);
calculateButton.addEventListener("click", calculateCurrentRaagData);
validateButton.addEventListener("click", validateCurrentRaagData);
outputButton.addEventListener("click", outputCurrentRaagData);

//GLOBAL LISTENER TO STORE CURRENT RAAG DATA (ENTER KEY-PRESS)
window.addEventListener('keydown', (event) => {
	if (event.key === 'Enter') { 
		logConsole("You pressed ENTER... Storing all current raag data as per input fields!");
		storeCurrentRaagData(); 
	}
});

//ON TABBING AWAY FROM INPUT ELEMENTS
for ( const inputElement of document.querySelectorAll("input, select, textarea") ) {
	inputElement.addEventListener( "keydown", (event) => 
		{
			//console.log("Keydown in", inputElement.id, "-", event.key, event.keyCode, event.target.id); 	// "→ relatedTarget:", event.relatedTarget
			//displayCalculatedOutput(event.target); 
		}
	);
}

//ON PRESSING 'ENTER' IN ANY OF THE EDITABLE(?) INPUT ELEMENTS
for ( const inputElement of document.querySelectorAll("input, select, textarea") ) {
	inputElement.addEventListener( "keydown", (event) => 
		{
			if (event.ctrlKey && event.key === "Enter") {
				//displayCalculatedOutput(inputElement);		//Fill respective output element
				//console.log("ctrlKey+Enter in", inputElement.id, "-", event.key, event.keyCode); 	//event.target.id, "→ relatedTarget:", event.relatedTarget
			}			
		}
	);
}

//RAAG INFO DISPLAY
function displayRaagInfo() {
	let currentRaagProperties = "";
	for (const key in currentRaag) {
		currentRaagProperties += key + ": " + currentRaag[key] + "\n";
	}
		
	raagInfo.textContent = currentRaagProperties;
	console.log("Printed", Object.keys(currentRaag).length, "currentRaag Properties with values.");
}

//ERROR DISPLAY 
function displayErrors() {
	if (dimensionInput.value === "") {
		errorsDisplay.textContent = 
		"ERROR! Dimension is not selected! currentRaag.dimension value will be stored as |" + dimensionInput.value + "|" + "\n";
	}
}

//OUTPUT DISPLAY
function displayOutput() {
	output.textContent = 
	"INSERT (" + currentRaag.name + ")" + 
	", [" + currentRaag.aaroh + "], [" + currentRaag.avaroh + "], " + 
	currentRaag.dimension + ", " + 
	currentRaag.shuddhataa_rank + ", " + 
	currentRaag.creator_id
	;
};

//////////////////////////////////////////////////
//RAAG TABLE CREATE FUNCTION
//////////////////////////////////////////////////

function createRaagDisplayTable () {
	const container = document.getElementById('currentRaagDisplayTableContainer')
	const table = document.createElement("table");
	//console.log(container, table);
	
	//CREATE TABLE HEAD & COLUMN HEADINGS (HTML ELEMENTS) IN THE ETHER
	const thead = document.createElement("thead");
	const th1 = document.createElement("th");
	const th2 = document.createElement("th");
	const th3 = document.createElement("th");
	
	//ADD TEXT TO COLUMN HEADING CELLS 
	th1.innerHTML = "Raag Property";
	th2.innerHTML = "Input Value";
	th3.innerHTML = "Stored Value";
	//console.log(thead, th1, th2, th3);
	
	//APPEND COLUMN HEADING CELLS TO TABLE HEAD, THEN APPEND TABLE HEAD TO TABLE
	thead.appendChild(th1);
	thead.appendChild(th2);
	thead.appendChild(th3);
	table.appendChild(thead);
	
	for (const raagProperty of Object.keys(currentRaag) ) {
		const storedValue = currentRaag[raagProperty];
		
		//Create row and its cells
		const row = document.createElement("tr");
		const cellColumn1 = document.createElement("td");
		const cellColumn2 = document.createElement("td");
		const cellColumn3 = document.createElement("td");
		
		//Raag Property Name (Column 1)
		cellColumn1.textContent = raagProperty;
		
		//Input element (Column 2)
		const inputBox = document.createElement("input");
		inputBox.id = raagProperty + "Input";
		inputBox.className = "inputBox";
		cellColumn2.appendChild(inputBox);
		inputBox.addEventListener("keydown", (event) => 
			{
				if (event.ctrlKey && event.key === "Enter") {
					currentRaag[raagProperty] = inputBox.value;
					displayCalculatedOutput(inputBox);		//Fill respective output element
					console.log("NEW RAAG TABLE! ctrlKey+Enter in", inputBox.id, "- val to be stored:", inputBox.value); 	//event.target.id, "→ relatedTarget:", event.relatedTarget
				}			
			}
		);
		
		//Output element - Stored Value Display (Column 3)
		const outputBox = document.createElement("output");
		outputBox.id = raagProperty + "Output";
		outputBox.className = "outputBox";
		cellColumn3.appendChild(outputBox);
		
		if (storedValue === null) {
			outputBox.textContent = "null";
		}
		else if (Array.isArray(storedValue)) {
			outputBox.textContent = "[]";
			//console.log("ARRAY FOUND!!!")
		}
		else {
			outputBox.textContent = currentRaag[raagProperty];
		}					
		
		cellColumn1.className = "label";
		cellColumn2.className = "inputField";
		cellColumn3.className = "outputField";
		
		row.appendChild(cellColumn1);
		row.appendChild(cellColumn2);
		row.appendChild(cellColumn3);
		table.appendChild(row);
		console.log(raagProperty, storedValue);	//, cellColumn1, cellColumn2, cellColumn3				
	}
	
	//REMOVE 'LOADING' MESSAGE, INSERT BUILT TABLE
	
	if (container) {
		container.innerHTML = '';
		container.appendChild(table);
	}
}

//TESTING FUNCTION, AFTER TIME FOR PAGE TO LOAD FULLY
/*setTimeout( () => { 
	console.log("waiting..."); 
	createRaagDisplayTable();
	console.log("DONE waiting..."); 
	}, 500 
);	*/