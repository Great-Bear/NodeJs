
const formidable = require( "formidable" ) ;  // Form parser
const fs         = require( "fs" ) ;          // file system
const { request } = require("http");

const WWW_ROOT     = "www" ;
const FILE_404     = WWW_ROOT + "/404.html" ;
const DEFAULT_MIME = "application/octet-stream" ;
const UPLOAD_PATH  = WWW_ROOT + "/pictures/"

module.exports = {
    analyze: function( request, response ) {
        response.setHeader('Access-Control-Allow-Origin', '*');
        const method = request.method.toUpperCase() ;
        switch( method ) {
            case 'GET'  :  // возврат списка картин
                doGet( request, response ) ;
                break ;
            case 'POST' :  // загрузка новой картины
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

function doOptions( request, response ) {
    // "Разведывательный" запрос. Мы должны ответить клиенту, что мы разрешаем (остальное - нет)
    // Обычные запросы
    response.setHeader('Allow', 'OPTIONS, GET, POST, PUT, DELETE' ) ;
    // CORS
    // без указания - проходят только OPTIONS, GET, POST
    response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, DELETE' ) ;
    // без указания - разрешается только text/plain (по умолчанию)
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type' ) ;
    response.end();
}

function doPut( request, response ) {
    extractBody( request )
    .then( validateOrm )
    .then( updatePicture )
    .then( results => {
        response.setHeader( 'Content-Type', 'application/json' ) ;
        response.end( JSON.stringify( { "result": results.affectedRows } ) ) ;
    } )
    .catch( err => { console.log( err ) ; response.errorHandlers.send412( err ) ; } ) ;
}

function doDelete( request, response ) {
    extractBody( request )
    .then( validateId )
    .then( deletePicture )  // id => deletePicture( id, request ) )
    .then( results => {
        response.setHeader( 'Content-Type', 'application/json' ) ;
        response.end( JSON.stringify( { "result": results.affectedRows } ) ) ;
    } )
    .catch( err => {
        console.log( err ) ;
        response.errorHandlers.send500() ;
    } ) ;
}

function doPost( request, response ) {
    // принять данные формы
    // ! отключить (если есть) наш обработчик событий data/end
    const formParser = formidable.IncomingForm() ;
    formParser.parse( 
        request, 
        (err, fields, files) => {
            if( err ) {
                console.error( err ) ;
                response.errorHandlers.send500() ;
                return ;
            }
            // console.log( fields, files ) ;
            // console.log( files["picture"] ) ;

            let validateRes = validatePictureForm( fields, files ) ;
            if( validateRes === true ) {
                // OK
                const savedName = moveUploadedFile( files.picture ) ;

                addPicture( {
                    title:       fields.title,
                    description: fields.description,
                    place:       fields.place,
                    filename:    savedName,
                    "users_id":  fields["users_id"]
                }, request.services )
                .then( results => {
                    res = { status: results.affectedRows } ;
                    response.setHeader( 'Content-Type', 'application/json' ) ;
                    response.end( JSON.stringify( res ) ) ;
                } )
                .catch( err => {
                    console.error( err ) ;
                    response.errorHandlers.send500() ;
                } ) ;
            } else {
                // Validation error, validateRes - message
                response.errorHandlers.send412( validateRes ) ;
                return ;
            }
        } ) ;  
} ;

function doGet( request, response ) {
    // Работа с пагинацией проходит в два этапа:
    // 1. Определяем количество записей и емкость страницы (в данном случае - 4)
    // 2. Формируем запрос на выборку

    // Учет всех условий должен быть на 1м этапе, т.к. от него зависит общее кол-во
    var conditions = " WHERE "
    var queryParams = [] ;
    if( typeof request.params.query.deleted == 'undefined' ) {
        conditions += " p.delete_DT IS NULL" ;
    } else {
        conditions += " p.delete_DT IS NOT NULL" ;
    }
    if( typeof request.params.query.userid != 'undefined' ) {  // Own pictures
        conditions += " AND p.users_id = ? " ;
        queryParams.push( request.params.query.userid ) ;
    } else if( typeof request.params.query.exceptid != 'undefined' ) {  // Not own pictures
        conditions += " AND ( p.users_id <> ? OR p.users_id IS NULL ) " ;
        queryParams.push( request.params.query.exceptid ) ;
    }
    // По собранным условиям определяем кол-во записей
    const cntQuery = "SELECT COUNT(*) AS cnt FROM pictures p " + conditions ;
    request.services.dbPool.query( 
        cntQuery,
        queryParams,
        ( err, results ) => {
            if( err ) {
                console.log( err ) ;
                response.errorHandlers.send500() ;
            } else {
                const totalCnt = results[0].cnt ;  // кол-во записей
                // этап 2: определяем лимиты и запрашиваем данные
                const perPage = 4 ;            
                const pageNumber = request.params.query.page ?? 1 ;
                const lastPage = Math.ceil( totalCnt / perPage ) ;  // (11,4) -> 3, (12,4) -> 3, (13,4) -> 4

                var limits = ` LIMIT ${perPage*(pageNumber-1)}, ${perPage}`;   // Pagination
                
                // const picQuery = "SELECT p.*, CAST(p.id AS CHAR) id_str FROM pictures p "  + conditions + limits;
                const picQuery = 
                `select 
                    p.*, 
                    CAST(p.id AS CHAR) id_str,
                    coalesce( v.rating, 0 ) rating,
                    coalesce( v.votes, 0 )  votes
                from 
                    pictures p 
                    left join 
                        (select 
                            picture_id,
                            sum(vote) rating,
                            count(id) votes 
                        from 
                            votes 
                        group by picture_id) v
                    on p.id = v.picture_id `  + conditions + limits;
                    
                request.services.dbPool.query( 
                    picQuery,
                    queryParams,
                    ( err, results ) => {
                    if( err ) {
                        console.log( err ) ;
                        response.errorHandlers.send500() ;
                    } else {
                        // console.log(results);
                        response.setHeader( 'Content-Type', 'application/json' ) ;
                        response.end( JSON.stringify( {
                            meta: {
                                'total':       totalCnt,
                                'perPage':     perPage,
                                'currentPage': pageNumber,
                                'lastPage':    lastPage
                            },
                            data: results
                        } ) ) ;
                    }
                } ) ;
            }
        }
    ) ;    
}

function updatePicture( body ) {
    var picQuery = "UPDATE pictures SET " ;
    var picParams = [] ;
    var needComma = false ;
    for( let prop in body )
        if( prop != 'id' ) {
            if( needComma ) picQuery += ", " ;
            else needComma = true ;
            picQuery += prop + " = ? " ;
            picParams.push( body[prop] ) ;
        }
    picQuery += " WHERE id = ?";
    picParams.push( body.id ) ;
    
    // return picQuery ;
    return new Promise( (resolve, reject) => {
        global.services.dbPool.query(
            picQuery,
            picParams,
            (err, results) => {
                if( err ) reject( err ) ;
                else resolve( results ) ;
            } ) ;
        } ) ;
}

function validateOrm( body ) {
    return new Promise( (resolve, reject) => {
        validateId( body )
        .then( () => {
            const orm = [ "id", "title", "description", "place", "filename", "users_id", "upload_DT", "delete_DT" ] ;
            for( let prop in body ) {
                if( orm.indexOf( prop ) == -1 )
                    reject( "ORM error: unexpected field " + prop ) ;
            }
            resolve( body ) ;
        } )
        .catch( err => reject( err ) ) ;
    } ) ;    
}

function deletePicture( id, request ) {
    return new Promise( (resolve, reject) => {
    global.services.dbPool.query(
        "UPDATE pictures SET delete_DT = CURRENT_TIMESTAMP WHERE id = ?",
        id,
        (err, results) => {
            if( err ) reject( err ) ;
            else resolve( results ) ;
        } ) ;
    } ) ;
}

function validateId( body ) {
    return new Promise( (resolve, reject) => {
        // Валидация: id должен присутствовать и состоять только из цифр
        if ( ! body.id || ! /^\d+$/.test( body.id ) ) {  // NaN - 1.56, 1e-1
            reject( "Id validation error" ) ;
        } else {
            resolve( body.id ) ;
        }
    } ) ;
}

function addPicture( pic, services ) {
    const query = "INSERT INTO pictures(title, description, place, filename, users_id) VALUES (?, ?, ?, ?, ?)" ;
    const params = [
        pic.title, 
        pic.description, 
        pic.place, 
        pic.filename,
        pic.users_id
    ] ;
    return new Promise( ( resolve, reject ) => {
        services.dbPool.query( query, params, ( err, results ) => {
            if( err ) reject( err ) ;
            else resolve( results ) ;
        } ) ;
    } ) ;    
}

function moveUploadedFile( file ) {
    var counter = 1 ;
    var savedName ;
    do {
        // TODO: trim filename to 64 symbols
        savedName = `(${counter++})_${file.name}` ;
    } while( fs.existsSync( UPLOAD_PATH + savedName ) ) ;
    fs.rename( file.path, UPLOAD_PATH + savedName, 
        err => { if( err ) console.log( err ) ; } ) ;
    return savedName ;
}

function validatePictureForm( fields, files ) {
    // задание: проверить поля на наличие и допустимость
    if( typeof files["picture"] == 'undefined' ) {
        return "File required" ;
    }
    // title should be
    if( typeof fields["title"] == 'undefined' ) {
        return "Title required" ;
    }
    if( fields["title"].length == 0 ) {
        return "Title should be non-empty" ;
    }
    // description should be
    if( typeof fields["description"] == 'undefined' ) {
        return "Description required" ;
    }
    if( fields["description"].length == 0 ) {
        return "Description should be non-empty" ;
    }
    // place optional. But if present then should be non-empty
    if( typeof fields["place"] != 'undefined'
     && fields["place"].length == 0 ) {
        return "Place should be non-empty" ;
    }
    // users_id optional:
    if( typeof fields["users_id"] == 'undefined' ) {
        fields["users_id"] = null;
    }
    return true ;
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
