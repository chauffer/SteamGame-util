// ==UserScript==
// @name	chauffer Steam Game AutoJoin
// @namespace	https://github.com/chauffer/SteamGameAutoJoin/
// @version	3.5.1
// @description	Auto-join script for 2015 Summer Steam Monster Minigame
// @author	geekahedron
// @match	*://steamcommunity.com/minigame
// @match	*://steamcommunity.com//minigame
// @match	http://steamcommunity.com/minigame/*
// @updateURL	https://raw.githubusercontent.com/chauffer/SteamGameAutoJoin/master/autojoin.user.js
// @downloadURL	https://raw.githubusercontent.com/chauffer/SteamGameAutoJoin/master/autojoin.user.js
// @grant	none
// ==/UserScript==

// This script is from geekahedron
// I put this in my repo because I use this myself, I link it to others, and I don't trust geekahedron.
// Please refrain from flaming. It's a couple of lines of Free Software.

//NOTE: This REQUIRES the use of GreaseMonkey or TamperMonkey
(function(w) {
    "use strict";

//**********************************************************************//
//*** FOR MANUAL INSTALL (COPY-PASTE INTO CONSOLE) START COPYING HERE ***//
//**********************************************************************//

function GetCurrentGameId()
{
	var play_div = document.getElementsByClassName('section_play')[0].children[1].children[0].children[0];
	if (play_div.tagName === "A")
	{
		return JoinGame.toString().match(/'[0-9]*'/)[0].replace(/'/g, '');
	}
	else if (play_div.innerHTML === "Sign in to play!")
	{
		console.log('Not signed in');
		return -1;
	}
	console.log('No current game');
	return 0;
}

function GetCurrentGame()
{
	var gameid = GetCurrentGameId();
	if (gameid > 0)
	{
		console.log('Current game: ' + gameid);
		var play_div = document.getElementsByClassName('section_play')[0].children[1].children[0].children[0].children[0];
		var paren_pos = play_div.innerHTML.search('[(]');
		var btn_text = play_div.innerHTML;
		if (paren_pos > 0) btn_text = play_div.innerHTML.substr(0,paren_pos-1);
		play_div.innerHTML = btn_text + ' (' + gameid + ')';
	}
	return gameid;

}

// Thanks to HandsomeMatt for the callback version of this function
function CheckAndLeaveCurrentGame( callback )
{
	var currentgame = GetCurrentGameId();
	if (currentgame === 0)
		return callback();
	console.log('Leaving current game: ' + currentgame);
	$J.post(
		'http://steamcommunity.com/minigame/ajaxleavegame/',
		{ 'gameid' : currentgame, 'sessionid' : g_sessionID }
	).done(
        function() { callback(); }
	);
}

function ResetUI()
{
    	StopRunning();
    	document.getElementById("auto_btn").children[0].innerHTML = "Auto Join Game";
//    	document.getElementById("autojoinid").value = "";
    	document.getElementById("autojoinid").focus();
}

function JoinGameLoop(roomlist, count)
{
	var rooms = roomlist.toArray();
	
	var gameid = rooms.pop();
	if (gameid && gameid.match(/^\d{5}$/))	// 3.2.2 verify 5-digit number
	{
		rooms.unshift(gameid);
	} else {
		console.log(gameid + ' is not a valid room number, removing');
		if (rooms.length > 0) JoinGameLoop(rooms, count);
	}

	if (rooms.length === 0)
	{
		ResetUI();
		console.log('Out of rooms');
	}
	else if (getPreferenceBoolean("keepRunning", false) === false) {
		ResetUI();
		console.log('Execution stopped by user');
	} else {
		console.log('(' + count + ') Joining room ' + gameid + ' [' + roomlist + ']');
		try {
			$J.post('http://steamcommunity.com/minigame/ajaxjoingame/', { 'gameid' : gameid, 'sessionid' : g_sessionID })
			.done(
				function( json ) {
					if ( json.success == '1' ) {
						console.log('Success! Joining room now');
						top.location.href = 'http://steamcommunity.com/minigame/towerattack/';
					} else {
						console.log('Not successful to join game ' + gameid);
						JoinGameLoop(rooms, count+1);
					}
				}).fail(
				function( jqXHR ) {
					console.log('Failed to join game ' + gameid);
					var responseJSON = jqXHR.responseText.evalJSON();
					HandleJoinError(rooms, gameid, count, responseJSON.success, responseJSON.errorMsg)
				}
			);
		}
		catch(e)	// 3.3 catch other errors (timeout, etc) that aren't handled by JSON
			{
				console.log(e);
				JoinGameLoop(rooms, count+1);
			}
	}
}

function HandleJoinError(roomlist, gameid, count, code, msg)
{
	var rooms = roomlist.toArray();
	switch(code)
	{
		case 25:	// room full
			console.log( code + ' Error joining game ' + gameid + ': it already has the maximum number of players.' );
			if (getPreferenceBoolean("tryFullRooms", true) != false)
			{
				JoinGameLoop(rooms, count+1 );
			} else {
				var gid = rooms.shift();
				console.log('Removing room ' + gid + ' from queue');
				if (rooms.length === 0)
				{
					console.log('No more rooms in queue');
					ResetUI();
					ShowAlertDialog( 'Error joining ' + gameid, 'There was a problem trying to join the game: it already has the maximum number of players.' );
				} else {
					JoinGameLoop(rooms, count+1 );
				}
				
			}
			break;
		case 28:	// previously quit room
			console.log( code + ' Error joining game ' + gameid + ': You have previously left this game. You cannot join this game again.' );
			var gid = rooms.shift();
			console.log('Removing room ' + gid + ' from queue');
			if (rooms.length === 0)
			{
				console.log('No more rooms in queue');
				ResetUI();
				ShowAlertDialog( 'Error joining ' + gameid, 'You have previously left this game. You cannot join this game again.' );
			} else {
				JoinGameLoop(rooms, count+1 );
			}
				break;
//		case 29:	// currently in a room
//        	console.log( code + ' Error joining game ' + gameid + ': You\'ll have to leave your current game to join this game. You will not be able to rejoin your current game.');
//        	CheckAndLeaveCurrentGame( function() {
//        		JoinGameLoop( gameid, count+1 );
//			});
//			break;
		case 24:	// undefined error (with message, hopefully)
			if (msg)
			{
				console.log( code + ' Error joining game ' + gameid + ': ' + msg );
				if (msg.search("higher than the highest level you have completed") != -1)
				{
					var gid = rooms.shift();
					console.log('Removing room ' + gid + ' from queue');
					if (rooms.length === 0)
					{
						console.log('No more rooms in queue');
						ResetUI();
						ShowAlertDialog( 'Error joining ' + gameid, msg );
					} else {
						JoinGameLoop(rooms, count+1 );
					}
				}
				else if (msg.search("maximum number of players") != -1)
				{
					if (getPreferenceBoolean("tryFullRooms", true) != false)
						{
						JoinGameLoop(rooms, count+1 );
					} else {
						var gid = rooms.shift();
						console.log('Removing room ' + gid + ' from queue');
						if (rooms.length === 0)
						{
							console.log('No more rooms in queue');
							ResetUI();
							ShowAlertDialog( 'Error joining ' + gameid, msg );
						} else {
							JoinGameLoop(rooms, count+1 );
						}
					}
				}
				else
				{
					CheckAndLeaveCurrentGame( function() {
						JoinGameLoop(rooms, count+1 );
					});
				}
				break;
			}	// if there is no message, assume the worst and cascade to default response
		default:
			console.log( code + ' Error joining game ' + gameid + ': There was a problem trying to join the game.' );
			CheckAndLeaveCurrentGame( function() {
				JoinGameLoop(rooms, count+1 );
			});
	}
}

function AutoJoinGame()
{
	StartRunning();
	var gameid = document.getElementById("autojoinid").value;
	gameid.replace(/[^0-9,]/g,'');	// 3.2.2 try and make sure there are only valid characters
	document.getElementById("autojoinid").value = gameid;
	if (gameid.search(/\d/) > -1)	// make sure we have at least a digit in there (for future, enforce 5-digit numbers?)
	{
		var rooms = gameid.split(',');
		document.getElementById("auto_btn").children[0].innerHTML = "Running..."
		console.log('Launching auto join for room(s): ' + gameid);
		JoinGameLoop(rooms, 1);
	} else {
		console.log('No room ID specified for auto join');
	}
}

//*** UI and preferences start here	***//

function DisplayUI()
{
	if (GetCurrentGame() >= 0)
	{
		var game_div = document.getElementsByClassName('section_play')[0].children[0];
		var play_div = document.getElementsByClassName('section_play')[0].children[1].children[0].children[0];
		var sgaj_sp = document.createElement("span");
		sgaj_sp.innerHTML = '<span><label for="autojoinid" class="main_btn">Game ID</label><input type="text" id="autojoinid" name="autojoinid" class="main_btn" /></span><a onClick="javascript:AutoJoinGame()" class="main_btn" id="auto_btn"><span>Auto Join Game</span></a><a onClick="javascript:StopRunning()" class="main_btn" id="stop_btn"><span>Stop</span></a>';
		game_div.appendChild(sgaj_sp,game_div.children[0]);
		document.getElementById('autojoinid').focus();
		addGlobalStyle('.section_play .current_game, .section_play .new_game {  margin-top: 10px; }');
		addGlobalStyle('#autojoinid { color: #404; background-color: #EEE; }');
		addGlobalStyle('.checklabel { color: #000; }');
	}
	
	var options1 = document.createElement("div");
	options1.className = "options_column";
	
	options1.appendChild(MakeCheckBox("tryFullRooms", "Continue when room is full", false, toggleFullRooms));
	setPreference("tryFullRooms", false);

	game_div.appendChild(options1);

	// TODO: Add UI features for users not logged in
}

// http://greasemonkey.win-start.de/patterns/add-css.html
function addGlobalStyle(css)
{
	var head, style;
	head = document.getElementsByTagName('head')[0];
	if (!head) { return; }
	style = document.createElement('style');
	style.type = 'text/css';
	style.innerHTML = css;
	head.appendChild(style);
}

function toggleFullRooms(event)
{
	var value = getPreferenceBoolean("tryFullRooms", false);
	
	setPreference("tryFullRooms", !value);
}

function MakeCheckBox(name, desc, state, listener)
{
	var label = document.createElement("label");
	var description = document.createTextNode(desc);
	var checkbox = document.createElement("input");

	checkbox.type = "checkbox";
	checkbox.name = name;
	checkbox.checked = state;
	checkbox.onclick = listener;
	
	label.className = "checklabel";

	label.appendChild(checkbox);
	label.appendChild(description);
	label.appendChild(document.createElement("br"));
	return label;
}

function setPreference(key, value) {
	try {
		if(localStorage !== 'undefined') {
			localStorage.setItem('steamdb-minigame-wormholers/' + key, value);
		}
	} catch (e) {
		console.log(e); // silently ignore error
	}
}

function getPreference(key, defaultValue) {
	try {
		if(localStorage !== 'undefined') {
			var result = localStorage.getItem('steamdb-minigame-wormholers/' + key);
			return (result !== null ? result : defaultValue);
		}
	} catch (e) {
		console.log(e); // silently ignore error
		return defaultValue;
	}
}

function getPreferenceBoolean(key, defaultValue) {
	return (getPreference(key, defaultValue.toString()) == "true");
}

// Allow redefining of function to use as state variable
setPreference("keepRunning", false);
function StartRunning()
{
	setPreference("keepRunning", true);
}
function StopRunning()
{
	setPreference("keepRunning", false);
}


DisplayUI();

//*********************************************************************//
//*** FOR MANUAL INSTALL (COPY-PASTE INTO CONSOLE) STOP COPYING HERE ***//
//*********************************************************************//

// Embed functions to be called directly from the UI in *-monkey installations
function embedFunction(s) {
    console.log('embedding: ' + s.name);
	document.body.appendChild(document.createElement('script')).innerHTML=s.toString().replace(/([\s\S]*?return;){2}([\s\S]*)}/,'$2');
}

// embed other functions used by UI after loading
embedFunction(GetCurrentGameId);
embedFunction(GetCurrentGame);
embedFunction(CheckAndLeaveCurrentGame);
embedFunction(JoinGameLoop);
embedFunction(HandleJoinError);
embedFunction(AutoJoinGame);
embedFunction(ResetUI);
embedFunction(MakeCheckBox);
embedFunction(toggleFullRooms);
embedFunction(StopRunning);
embedFunction(StartRunning);
embedFunction(setPreference);
embedFunction(getPreference);
embedFunction(getPreferenceBoolean);

}(window));
