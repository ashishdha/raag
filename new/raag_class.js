class Raag {
	constructor() {
		this.name 						= null;		//* phonetic Roman spelling
		this.aaroh                      = [];   	//* Array of generic svars occuring in ascending movements in the raag, simplest possible path
		this.avaroh                     = [];		//* Array of generic svars occuring in descending movements in the raag, simplest possible path
		
		this.thaat_id                   = -999;	    // thaaT ID (References ThaaT table) of the combined svarset (1-32)
  		this.aaroh_jaati                = -999;	  	// generic svar counts in UP direction
  		this.avaroh_jaati               = -999;	  	// generic svar counts in DOWN direction
  		this.shuddhataa_rank            = -999;		// Weighted sum of pitch-class weights for the combined svarset. Lower = more shuddha
  		this.samvaad_at_pa              = -999;		// Aggregated Saa-Pa samvaad score as percent across aaroh and avaroh combined. 
		
  		this.samvaad_at_ma              = -999;		// Aggregated Saa-Ma samvaad score as percent across aaroh and avaroh combined. 
  		this.symmetry_score             = -999;		// Aggregated symmetry score as percent of aaroh and avaroh around the tritone axis
  		this.dimension                  = -999;		//* Dimensionality classification of the raag (1 to 5)
  		this.ang_balance                = -999;     // combined ang balance metric
  		this.saa_pa_chains              = [];   	// 2D array (JSON OBJECT) representing chains of svarsthaans in Saa-Pa samvaad relationship
		
  		this.saa_ga_chains              = [];   	// 2D array (JSON OBJECT) representing chains of svarsthaans in Saa-Ga samvaad relationship
  		this.imperfect_svarsthaan       = [];		// array of svarsthaan in the svarset with no Pa sangati but having Ma sangati
  		this.detached_svarsthaan        = [];		// array of svarsthaan in the svarset with no Pa sangati AND no Ma sangati
  		this.svarset                    = [];   	// array of specific svarsthaan present in either aaroh or avaroh
  		this.moorchhanaa_family_id      = -999;    	// modal family ID (References Scale table) of the combined svarset
  		this.varjit_svar                = [];   	// Array of generic varjit (omitted) svars in the raag
  		this.largest_jump               = -999;		// Largest melodic interval (in semitones) between any two consecutive svarsthaan
  		this.largest_jump_direction     = -999; 	// -1 = aaroh, 0 = same in both, 1 = avaroh
  		this.smallest_jump              = 999;     	// Smallest melodic interval (in semitones) between any two consecutive svarsthaan
  		this.smallest_jump_direction    = -999; 	// -1 = aaroh, 0 = same in both, 1 = avaroh
		
		this.saa_absenceID  			= -999; 	// 0=present in both, 1=absent only in aaroh, 2=absent only in avaroh, 3=absent in aaroh && often dodged in avaroh, 4=often dodged in aaroh && absent in avaroh, 5=absent in both
  		this.consecutive_varjit_svar    = -999;    	// highest number of consecutive varjit svar (generic)
  		this.both_variants         	  	= -999;	  	// Number of generic svar with both variants in either aaroh OR avaroh.
  		this.aaroh_only_svar_count      = -999;	  	// Number of generic svar that are ONLY in aaroh and NOT in avaroh
  		this.avaroh_only_svar_count     = -999;	  	// Number of generic svar that are ONLY in avaroh and NOT in aaroh
  		this.jaati_difference           = -999;		// avaroh_jaati minus aaroh_jaati
  		this.lower_to_higher_variants   = -999;	  	// Number of generic svar with ONLY lower variant in aaroh AND ONLY higher variant in avaroh. 
  		this.lower_to_both_variants     = -999;     // Number of generic svar with ONLY lower variant in aaroh AND both variants in avaroh.
  		this.both_to_higher_variants    = -999;     // Number of generic svar with both variants in aaroh AND ONLY higher variant in avaroh.
  		this.both_to_lower_variants     = -999;     // Number of generic svar with both variants in aaroh AND ONLY lower variant in avaroh.
  		this.higher_to_both_variants    = -999;     // Number of generic svar with ONLY higher variant in aaroh AND both variants in avaroh.
  		this.higher_to_lower_variants   = -999;	  	// Number of generic svar with ONLY higher variant in aaroh AND ONLY lower variant in avaroh.
  		this.common_svarsthaan          = -999;	  	// number of svarsthaan common between aaroh and avaroh (including Saa)
  		this.common_svarsthaan_poorvaang= -999;	  	// number of svarsthaan common between poorvaang of aaroh and avaroh [including Saa]
  		this.common_svarsthaan_uttaraang= -999;	  	// number of svarsthaan common between uttaraang of aaroh and avaroh [including Saa]
  		this.common_svar                = -999;     // Number of generic svars common between aaroh and avaroh
  		this.common_svar_poorvaang      = -999;     // Number of generic svars common between poorvaang of aaroh and avaroh
  		this.common_svar_uttaraang      = -999;     // Number of generic svars common between uttaraang of aaroh and avaroh
  		this.largest_saa_pa_chain_size  = -999;		// total count of largest chain of svarsthaan in Saa-Pa sambhaav
  		this.saa_pa_chains_count        = -999;		// total number of chains of svarsthaan in Saa-Pa sambhaav
  		this.largest_saa_ga_chain_size  = -999;		// total count of largest chain of svarsthaan in Saa-Ga sambhaav
  		this.saa_ga_chains_count        = -999;		// total number of chains of svarsthaan in Saa-Ga sambhaav
  		this.family_root                = false;	// TRUE if this raag's svarset is the parent scale of its moorchhanaa family, else FALSE
  		this.imperfect_count        	= -999;		// number of specific svarsthaan in the imperfect_svarsthaan array 
  		this.detached_count         	= -999;		// number of specific svarsthaan in the detached_svarsthaan array 
  		this.varjit_svar_count          = -999;     // total count of specific varjit svars across the combined scale
  		this.svarsthaan_count           = -999;     // total number of specific svarsthaan in combined svarset
  		this.poorvaang_count            = -999;    	// number of specific svarsthaan in poorvaang of combined svarset (S through m inclusive)
  		this.uttaraang_count            = -999;    	// number of specific svarsthaan in uttaraang of combined svarset (P through S' inclusive) 
  		this.aaroh_size                 = -999;	  	// number of specific svarsthaan in aaroh
  		this.avaroh_size                = -999;	  	// number of specific svarsthaan in avaroh
  		this.varjit_svar_aaroh          = [];   	// Array of specific varjit svars in aaroh
  		this.varjit_svar_avaroh         = [];   	// Array of specific varjit svars in avaroh
  		this.ang_balance_aaroh          = -999;		// number of svar-sthaan in uttaraang minus in poorvaang of aaroh.
  		this.ang_balance_avaroh         = -999;		// number of svar-sthaan in uttaraang minus in poorvaang of avaroh.
  		this.poorvaang_count_aaroh      = -999;     // Specific svarsthaan count in poorvaang of aaroh
  		this.uttaraang_count_aaroh      = -999;     // Specific svarsthaan count in uttaraang of aaroh
  		this.poorvaang_count_avaroh     = -999;     // Specific svarsthaan count in poorvaang of avaroh
  		this.uttaraang_count_avaroh     = -999;     // Specific svarsthaan count in uttaraang of avaroh

  		this.aaroh_id                   = -999;		// 
  		this.avaroh_id                  = -999;     // 
  		this.raag_id                 	= -999;    	// DEFAULT 1. NOT FILLED BY CHUCK POSITIONAL INSERTS !!
  		this.svarset_id                 = -999;		// 

  // ── LOCAL COUNTERS FROM GENERATOR LOOP ──────────────────────────────────────────
  		this.aaroh_number               = -999;    	//* what-th number aaroh was this in the ChucK raag generator. 
  		this.avaroh_number              = -999;    	//* what-th number avaroh was this of its aaroh, in the ChucK raag generator. 

  // ── MANUALLY ADDED VALUES (NOT calculated by ChucK) ────────────────────────────
  		this.angID                     	= null;     //* 
  		this.samayID                   	= null;     //* 
  		this.taanpuraaTuningID 			= null;		//* pitchclass int array for the svar to tune the taanpuraa strings to
  		this.creatorID           		= null;     //* 
  		this.popularityID              	= null;     //* 
  		this.carnaticName              	= null;		//* name in Carnatic system
  		this.alternateNames            	= null;		//* other spellings, names in other systems like Carnatic, Western etc
  		this.notes                	    = null;		//* chalan notes, etc
	}
	
	//////////////////////////////////////////////////////////////////
	//SET METHODS
	//////////////////////////////////////////////////////////////////
	
	//AAROH 
	setAaroh(givenAarohString) {		
		this.aaroh = string2intArray(givenAarohString);		
		console.log("Converted & stored given aaroh: ", givenAarohString, "  as array ", this.aaroh);
		return JSON.stringify(this.aaroh);
	}
	
	calcAaroh(givenAarohString) {		
		const calculatedAaroh = string2intArray(givenAarohString);		
		console.log("Converted given aaroh string: ", givenAarohString, "  to int array ", calculatedAaroh);
		return JSON.stringify(calculatedAaroh);
	}
	
	//AVAROH 
	setAvaroh(givenAvarohString) {		
		if (givenAvarohString === "") {
			this.avaroh = [...this.aaroh].reverse();
		}
		else {
			this.avaroh = string2intArray(givenAvarohString);
		}
		console.log("Converted & stored given avaroh: ", givenAvarohString, "  as array ", this.avaroh);
		return JSON.stringify(this.avaroh);
	}
		
	//DIMENSION
	setDimension(givenDimension) {
		this.dimension = givenDimension;
		console.log("Stored given dimension as: ", "|" + this.dimension + "|");
		return this.dimension;
	}
	
	//NAME
	setName(givenNameString) {
		this.name = givenNameString.trim();
		console.log("Trimmed & stored given name as: ", "|" + this.name + "|");
		return this.name;
	}
	
	//HUMAN DATA
	setHumanData(givenCreatorID) {
		this.creator_id = givenCreatorID;
		console.log("Stored given CreatorID as: ", this.creator_id);
		return this.creator_id;
	}
	
	
	//////////////////////////////////////////////////////////////////
	//CONTROL AND VALIDATION METHODS
	//////////////////////////////////////////////////////////////////
	
};