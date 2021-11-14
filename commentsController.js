module.exports = {
    analyze: function( request, response ) {
        // response.setHeader('Access-Control-Allow-Origin', '*');
        const method = request.method.toUpperCase() ;
        switch( method ) {
            case 'GET'  :  
            doGet(request,response);
                break ;
            case 'POST' :  
                var chunks = [] ;
                request.on( "data", chunk => { chunks.push( chunk ) ; } )
                       .on( "end", () => {
                            const body = JSON.parse( Buffer.concat( chunks ).toString() ) ;
                            console.log(body)
                            validateOrm( body )
                            .then(addComment)
                            .then( results => {
                                response.end( JSON.stringify(  results  ) ) ;
                            })
                            .catch( err => {
                                console.log( err ) ;
                                response.errorHandlers.send500() ;
                            });
                           // response.end( `POST Votes works !! user_id = ${body.users_id}, picture_id = ${body.picture_id}, vote = ${body.vote}` ) ;
                       });
               // response.end("Comments POST works !!")
                break ;
            case 'DELETE' :  
            doDelete( request, response ) ;
                break ;
            case 'PUT' :  
             doPut( request, response );
                break ;
            case 'OPTIONS' :  
               
                break ;
        }
    }
} ;
function doPut( request, response ){
    extractBody( request )
    .then( updateComment )
    .then( results => {
        response.setHeader( 'Content-Type', 'application/json' ) ;
        response.end( JSON.stringify( { "result": results.affectedRows } ) ) ;
    } )
    .catch( err => { console.log( err ) ; response.errorHandlers.send412( err ) ; } ) ;
}

function updateComment(body){
    var picQuery = `UPDATE comments SET commentText = "${body.newText}" WHERE id = ${body.idCom} ` ;
    return new Promise( (resolve, reject) => {
        global.services.dbPool.query(
            picQuery,
            (err, results) => {
                if( err ) reject( err ) ;
                else resolve( results ) ;
            } ) ;
        } ) ;
}

function  doDelete( request, response ) {
    extractBody( request )
    .then( deleteComments )
    .then( results => {
        response.setHeader( 'Content-Type', 'application/json' ) ;
        response.end( JSON.stringify( { "result": results.affectedRows } ) ) ;
    } )
    .catch( err => { console.log( err ) ; response.errorHandlers.send412( err ) ; } ) ;
}

function doGet( request, response ) {
    let cntQuery = `SELECT login, c.id, commentText, moment, users_id AS AuthorComment FROM users p RIGHT join
    ( SELECT commentText, moment, users_id, picture_id, id  FROM comments  )
     c on p.id = c.users_id WHERE c.picture_id= ${request.params.query.idPic}`;
    request.services.dbPool.query( 
        cntQuery,
        ( err, results ) => {
            if( err ) {
                console.log( err ) ;
                response.errorHandlers.send500() ;
            } else {
                    response.end( JSON.stringify( results ) )
            }
        })
}

function deleteComments( body ){

    return new Promise( (resolve, reject) => {
        global.services.dbPool.query(
            `DELETE FROM comments WHERE id = ${body.id}`,
            (err, results) => {
                if( err ) reject( err ) ;
                else resolve( results ) ;
            } ) ;
        } ) ;
}

function addComment( body ) {
    const params = [ body.users_id, body.picture_id, body.commentText ] ;
    const sql = "INSERT INTO comments( users_id, picture_id, commentText ) VALUES (?, ?, ?) " ;
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

function validateOrm( body ) {
    return new Promise( ( resolve, reject ) => {
        const orm = [ "users_id", "picture_id", "commentText" ] ;
        for( let prop in body ) {
            if( orm.indexOf( prop ) == -1 ) {
                reject( "ORM error: unexpected field " + prop ) ;
            }
        }
        resolve( body ) ;
    });
}

function extractBody( request ) {
    return new Promise( ( resolve, reject ) => {
        let requestBody = [] ; // массив для чанков
        request
            .on( "data", chunk => requestBody.push( chunk ) )
            .on( "end", () => {
                try { 
                    resolve( JSON.parse( 
                        Buffer.concat( requestBody ).toString()
                    ) ) ;
                }
                catch( ex ) {
                    reject( ex ) ;
                }
           } ) ;
    } ) ;    
}