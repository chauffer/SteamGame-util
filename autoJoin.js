// SteamGame Autojoiner
// Copy paste in console

// do this in console when room ID is announced:
// tj = roomid;
// EXAMPLE:
// tj = 44660;


var tj = -1;

function leaveCurrentGame( callback )
{
	var currentgame = ShowFriendsGames.toString().match(/'current_gameid' : '([0-9]*)'/)[1];
	console.log('Current Game: ' + currentgame);
 
	if (currentgame == 0)
  {
		betterJoinGameID(tj);
    return;
  }
	$J.post(
		'http://steamcommunity.com/minigame/ajaxleavegame/',
		{ 'gameid' : currentgame, 'sessionid' : g_sessionID }
	).done( function() { betterJoinGameID(tj); } );
}

function tryJoinRoom()
{
	if(tj == -1)
		return;
		
	clearInterval( tryTimer );
  
	leaveCurrentGame();
}
 
function betterJoinGameID()
{
	console.log('Trying to join room ' + tj);
 
	$J.post(
		'http://steamcommunity.com/minigame/ajaxjoingame/',
		{ 'gameid' : tj }
	).done( function( json ) {
			if ( json.success == '1' )
			{
				top.location.href = 'http://steamcommunity.com/minigame/towerattack/';
				return;
			}
 
			console.log('Failed to join room ' + tj);
      betterJoinGameID( tj );
		}
	).fail( function( jqXHR ) {
			var responseJSON = jqXHR.responseText.evalJSON();
			if ( responseJSON.success == '24' && responseJSON.errorMsg )
				console.log( responseJSON.errorMsg );
			else if ( responseJSON.success == '25' )
				console.log('Failed to join room ' + tj + ' - Full');
			else
				console.log('Failed to join room ' + tj);
 
      betterJoinGameID( tj );
		}
	);
}
var tryTimer = setInterval( tryJoinRoom, 1000 );
tryJoinRoom();
