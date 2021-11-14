
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

function doGet( request, response ) { response.end( "Votes works !!" ) ; }

function doPost( request, response ) {
    var chunks = [] ;
    request.on( "data", chunk => { chunks.push( chunk ) ; } )
           .on( "end", () => {
                const body = JSON.parse( Buffer.concat( chunks ).toString() ) ;
                validateOrm( body )
                .then( addVote )
                .then( results => {
                    response.end( JSON.stringify( { 'result': results.affectedRows } ) ) ;
                })
                .catch( err => {
                    console.log( err ) ;
                    response.errorHandlers.send500() ;
                });
               // response.end( `POST Votes works !! user_id = ${body.users_id}, picture_id = ${body.picture_id}, vote = ${body.vote}` ) ;
           });
    
}

function doPut( request, response ) { response.end() ; }

function doDelete( request, response ) { response.end() ; }

function doOptions( request, response ) { response.end() ; }

function validateOrm( body ) {
    return new Promise( ( resolve, reject ) => {
        const orm = [ "users_id", "picture_id", "vote" ] ;
        for( let prop in body ) {
            if( orm.indexOf( prop ) == -1 ) {
                reject( "ORM error: unexpected field " + prop ) ;
            }
        }
        resolve( body ) ;
    });
}

function addVote( body ) {
    const params = [ body.users_id, body.picture_id, body.vote ] ;
    const sql = "INSERT INTO votes( users_id, picture_id, vote ) VALUES (?, ?, ?) " ;
    return new Promise( (resolve, reject) => {
        global.services.dbPool.query( sql, params, (err, results) => {
            if( err ) {
                reject( err ) ;
            } else {
                resolve( results ) ;
            }
        } ) ;
    } ) ;
}
