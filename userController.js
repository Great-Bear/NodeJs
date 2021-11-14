const crypto = require( 'crypto' ) ; 

module.exports = {
    analyze: function( request, response ) {
        // response.setHeader('Access-Control-Allow-Origin', '*');
        const method = request.method.toUpperCase() ;
        switch( method ) {
            case 'GET'  :  
                doGet( request, response ) ;
                break ;
            case 'POST' :  
                doPost( request, response ) ;
                break ;
            case 'DELETE' :  
                doDelete( request, response ) ;
                break ;
            case 'PUT' :  
                doPut( request, response ) ;
                break ;
            case 'OPTIONS' :  
                doOptions( request, response ) ;
                break ;
        }
    }
} ;

function doGet( request, response ) {
    // if ?/logout 
    if( typeof request.params.query.logout != 'undefined' ) {
        global.session = null ;
        response.setHeader( "Set-Cookie", `session-id=0;max-age=0;path=/` ) ;
        response.end( "Done" ) ;
        return ;
    }
    // else
    // server-side validation
    var errorMessage = "" ;
    var userlogin, userpassw ;

    if( typeof request.params.query.userlogin == 'undefined' ) 
        errorMessage = "userlogin required" ;
    else {
        userlogin = request.params.query.userlogin ;
        if( userlogin.length == 0 ) errorMessage = "userlogin may not be empty" ;
    }

    if( typeof request.params.query.userpassw == 'undefined' )
        errorMessage = "userpassw required" ;
    else {
        userpassw = request.params.query.userpassw ;
        if( userpassw.length == 0 ) errorMessage = "userpassw may not be empty" ;
    }

    if( errorMessage.length > 0 ) {
        response.errorHandlers.send412( errorMessage ) ;
        return ;
    } 
    // end of validation

    // authorization - get id by log/pass
    getUsersByLogin( userlogin )
    .then( results => {
        if( results.length > 0 ) {
            // extract salt / compute hash(salt+pass) / compare with stored hash
            const pass = crypto
                .createHash( 'sha1' )
                .update( userpassw + results[0].pass_salt )
                .digest( 'hex' );
            if( results[0].pass_hash == pass ) {
                let userId = results[0].id_str ;
                updateLastLoginDt( userId ) ;
                response.setHeader( "Set-Cookie", `session-id=${userId};max-age=1000;path=/` ) ;
                response.end( userId ) ;
                return ;
            }
        }
        response.end( "0" ) ;
    } )
    .catch( err => { console.log( err ) ; response.errorHandlers.send500() ; } ) ;
}

function doPost( request, response ) {
    response.end() ;
}

function doDelete( request, response ) {
    response.end() ;
}

function doPut( request, response ) {
    response.end() ;
}

function doOptions( request, response ) {
    response.end() ;
}

async function getUsersByLogin( login ) {
    return new Promise( (resolve, reject) => {
        global.services.dbPool.query(
            "SELECT *, CAST(id AS CHAR) AS id_str FROM users WHERE login=?", 
            login, 
            ( err, results ) => {
            if( err ) {
                reject( err ) ;
            } else {
                resolve( results ) ;
            }
        } ) ;
    } ) ;
}

function updateLastLoginDt( userId ) {
    global.services.dbPool.query(
        'UPDATE users SET last_login_dt = CURRENT_TIMESTAMP WHERE id=?',
        userId,
        err => { if( err ) console.log( updateLastLoginDt + " " + err ) ; }
    ) ;
}