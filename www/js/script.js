document.addEventListener("submit",(e)=>{
    e.preventDefault();
    const form = e.target;

    const title = form.querySelector("input[name=title]");
    if(!title) throw "Data transfer error: input[name=title] not found";

    const descr = form.querySelector("input[name=description]");
    if(!descr) throw "Data transfer error: input[name=description] not found";
    const place = form.querySelector("input[name=place]");
    if(!place) throw "Data transfer error: input[name=place] not found";
    const picture = form.querySelector("input[name=picture]");
    if(!picture) throw "Data transfer error: input[name=picture] not found";
    // TODO: data validation

    const formData = new FormData();
    formData.append("title", title.value);
    formData.append("description", descr.value);
    // place optional, include if not empty
    if(place.value.length > 0)
        formData.append("place", place.value);
    formData.append("picture", picture.files[0]);
    formData.append("users_id", findUserId());
    fetch("/api/picture", {
        method: "POST",
        body: formData  // new URLSearchParams(formData).toString()
    }).then(r=>r.text()).then(console.log);
});

function findUserId() {
    // user-id (if present) -- <div... id=id="user-block" user-id="{{id_str}}" user-id="{{id_str}}"
    const userBlock = document.getElementById("user-block");
    if(userBlock){
        const userId = userBlock.getAttribute("user-id");
        if(userId){
            return userId;
        }
    }
    return null;
}

document.addEventListener("DOMContentLoaded", ()=>{
    // создаем объект galleryWindow
    window.galleryWindow = {
        state: {},
        changeState: s => {
            if( typeof s == 'undefined' ) return ;
            const state = window.galleryWindow.state;

            if( typeof s["pageNumber"] != 'undefined') state.pageNumber = s["pageNumber"];
            
            if( typeof s["userMode"] != 'undefined' && s["userMode"] != state.userMode){
                state.userMode   = s["userMode"];
                state.pageNumber = 1;
            } 
            
            var url = "/api/picture?page=" + state.pageNumber;
            if(state.userMode == 1) {  // Own
                url += "&userid=" + findUserId();
            } else if (state.userMode == 2) {  // Not Own
                url += "&exceptid=" + findUserId();
            } else {  // All
            }
            
            fetch(url).then(r=>r.text()).then(t=>{
                // console.log(t);
                const j = JSON.parse(t);
                const cont = document.getElementById("gallery-container");
                fetch("/templates/picture.tpl").then(r=>r.text()).then(tpl=>{
                    var html = "";
                    for(let p of j.data){
                        if(p.lastComment == null){
                            p.lastComment = "Ещё нет коментариев";
                        }
                        html += tpl.replace("{{id}}",p.id_str)
                                .replace("{{title}}",p.title)
                                .replace("{{description}}",p.description)
                                .replace("{{place}}",p.place)
                                .replace("{{filename}}",p.filename)
                                .replace("{{rating}}",p.rating)
                                .replace("{{countComments}}",p.comments)
                                .replace("{{lastComments}}",p.lastComment);
                    }
                    cont.innerHTML = html;
                    window.galleryWindow.state.pageNumber = j.meta.currentPage ;
                    window.galleryWindow.state.lastPage = j.meta.lastPage ;
                    addToolbuttonListeners();
                    document.dispatchEvent(new CustomEvent(
                        "galleryWindowChange",
                        { detail: window.galleryWindow.state }
                    ));
                });
            });
        }
    };
    window.galleryWindow.changeState( { pageNumber: 1, userMode: 0 } ) ;
 } );

async function addToolbuttonListeners() {
    for(let b of document.querySelectorAll(".tb-delete"))
        b.addEventListener("click",tbDelClick);
    for(let b of document.querySelectorAll(".tb-edit"))
        b.addEventListener("click",tbEditClick);
    for(let b of document.querySelectorAll(".tb-download"))
        b.addEventListener("click",tbDownloadClick);
}

function tbDelClick(e) {
    if(!confirm("Are you sure?")) return;

    const div = e.target.closest("div");
    const picId = div.getAttribute("picId");
    // console.log(picId);
    fetch("/api/picture",{
        method: "delete",
        headers: {
            'Content-Type': 'application/json'
        },
        body: `{"id":"${picId}"}`
    }).then(r=>r.json()).then(j=>{
        // в ответе сервера должно быть поле result, в нем (affectedRows)
        // если 1 - было удаление, 0 - не было
        if(typeof j.result == 'undefined' ) alert("Some error");
        else if (j.result == 1){
            // удалить div из контейнера картин
            div.remove();
            alert("Delete completed!");
        }
        else alert("Deleted fail");
    });
}

function tbEditClick(e){
    const div = e.target.closest("div");
    const picId = div.getAttribute("picId");
    // console.log(picId);
    const place = div.querySelector("i");
    if(!place) throw "EditClick: place(<i>) not found";
    const descr = div.querySelector("p");
    if(!descr) throw "EditClick: description(<p>) not found";

    // toggle effect
    if( typeof div.savedPlace == 'undefined'){  // first click
        div.savedPlace = place.innerHTML;
        div.savedDecription = descr.innerHTML;
        // editable content
        place.setAttribute("contenteditable", "true");
        descr.setAttribute("contenteditable", "true");
        descr.focus();
    
        console.log(div.savedPlace, div.savedDecription);
    } else {  // second click
        // no changes - no fetch
        // one field changed - one filed fetched
        let data = {} ;
        if(div.savedPlace != place.innerHTML) data.place = place.innerHTML;
        if(div.savedDecription != descr.innerHTML) data.description = descr.innerHTML;
        if(Object.keys(data).length > 0){
            data.id = picId;
            fetch('/api/picture',{
                method: "put",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(r=>r.text()).then(console.log);
        }
        delete div.savedPlace;
        delete div.savedDecription;
        place.removeAttribute("contenteditable");
        descr.removeAttribute("contenteditable");

    }
}

function tbDownloadClick(e){
    const div = e.target.closest("div");
    const picId = div.getAttribute("picId");
    console.log(picId);
    window.location = "/download?picid=" + picId;
}

document.addEventListener("DOMContentLoaded", loadAuthContainer);

async function loadAuthContainer() {
    const authContainer = document.getElementById("auth-container");
    if(!authContainer) throw "auth-container not found";
    fetch('/templates/auth.tpl')
    .then(r=>r.text())
    .then(t=>{ authContainer.innerHTML=t; authControls(); });
}

async function authControls() {
    // user-block - auth
    const userBlock = document.getElementById("user-block");
    if(!userBlock) throw "userBlock not found";
    // button click
    const logBtn = userBlock.querySelector("input[type=button]");
    if(!logBtn) throw "logIn button not found";
    if(userBlock.classList.contains('user-block-auth')){ // Выход
        logBtn.addEventListener("click", ()=>{
            fetch(`/api/user?logout`)
            .then(r=>r.text()).then(loadAuthContainer);
        });
        // selector - filter <select id="filter-shown">
        const filterShown = document.getElementById("filter-shown");
        if(filterShown){
            filterShown.addEventListener("change",filterShownChange);
        }
    } else { // Вход
        logBtn.addEventListener("click", ()=>{
            const userLogin = userBlock.querySelector("input[type=text]");
            if(!userLogin) throw "userLogin input not found";
            const userPassw = userBlock.querySelector("input[type=password]");
            if(!userPassw) throw "userPassw input not found";
            // validation
            if(userLogin.value.length == 0){
                alert("Логин не может быть пустым");
                return;
            }
            if(userPassw.value.length == 0){
                alert("Пароль не может быть пустым");
                return;
            }
            fetch(`/api/user?userlogin=${userLogin.value}&userpassw=${userPassw.value}`)
            .then(r=>r.text()).then(authUser);

            // console.log(userLogin.value, userPassw.value);
        });
    }
}

async function authUser(txt){
    // txt = 0 | userId
    if(txt == "0") alert("Авторизация отклонена");
    else loadAuthContainer();
   // console.log(txt);
}

function filterShownChange(e) {
    window.galleryWindow.changeState({ userMode: e.target.value });
}
// --------- PAGINATION ------------
document.addEventListener("DOMContentLoaded", () => {
    const prevPageButton = document.getElementById("prevPageButton");
    if(!prevPageButton) throw "Pagination: prevPageButton not found";
    const nextPageButton = document.getElementById("nextPageButton");
    if(!nextPageButton) throw "Pagination: nextPageButton not found";
    prevPageButton.addEventListener("click", prevPageButtonClick);
    nextPageButton.addEventListener("click", nextPageButtonClick);
} );
function prevPageButtonClick(e){
    const paginationBlock = e.target.parentNode;
    // var page = paginationBlock.getAttribute("page-number");
    var page = window.galleryWindow.state.pageNumber;
    if(page > 1){
        page--;
        //paginationBlock.setAttribute("page-number", page);
        //window.currentPageNumber.innerText = page;
        window.galleryWindow.changeState({pageNumber: page});
    }
    // console.log(page);
}
function nextPageButtonClick(e){
    const paginationBlock = e.target.parentNode;
    // var page = paginationBlock.getAttribute("page-number");
    var page = window.galleryWindow.state.pageNumber;
    if(page < window.galleryWindow.state.lastPage){
        page++;
        //paginationBlock.setAttribute("page-number", page);
        //window.currentPageNumber.innerText = page;
        window.galleryWindow.changeState({pageNumber: page});
    }
    // console.log(page);
}

function currentPageNumberListener(e){
    window.currentPageNumber.innerText = e.detail.pageNumber;
}
document.addEventListener("galleryWindowChange", currentPageNumberListener);

// -------- VOTES --------------
function voteHandler(e){
    var vote = e.target.classList.contains("vote-dislike")
                ? -1
                : 1 ;
    // user_id
    const userId = findUserId();
    // picture_id
    const pictureId = e.target.closest("[picId]").getAttribute("picId");
    // console.log(userId, pictureId, vote);

    fetch("/api/votes", {
        method: "post",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "users_id": userId,
            "picture_id": pictureId,
            "vote": vote
        })
    }).then(r=>r.text()).then( (res) => { 
        if(JSON.parse(res).result){
          let voteTotal = e.target.closest("[picId]").querySelector('.vote-total');
           voteTotal.innerHTML =  parseInt( voteTotal.innerHTML) + vote;
        }     
        console.log(res);
     });
}
function setVotesHadlers(){
    for(let v of document.querySelectorAll(".vote-like,.vote-dislike")){
        // element.addEventListener("click",like)
        v.onclick = voteHandler;
    }
}

function addNewComments(e){
    const userId = findUserId();
    const textComment = e.target.closest("[picId]").querySelector('.textCommentField');
    const pictureId = e.target.closest("[picId]").getAttribute("picId");

    if(userId == null){
        if(confirm("You are not authorized you comment will be anonymous would you want continue?") == false){
            textComment.value = '';
            return;
        }
    }
  
    if(textComment.value == ''){
        alert("comments can`t be empty");
        return;
    }
    fetch("/api/comments", {
        method: "post",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "users_id": userId,
            "picture_id": pictureId,
            "commentText": textComment.value
        })
    }).then(r=>r.text()).then( (res) => { 
        if(!JSON.parse(res).affectedRows){
            alert("Comment was not saved");
        }
        else{
            textComment.value = '';
            let countComments = parseInt(e.target.closest("[picId]").querySelector(".countComments").children[0].innerText);
            e.target.closest("[picId]").querySelector(".countComments").children[0].innerText = ++countComments;
            showAllComments(e);
        }
     });
}

function setCommentsHandler(){  
    for(let btn of document.querySelectorAll(".addComments")){
        btn.onclick = addNewComments;
    }
}
function showCommentsHandler(){  
    for(let btn of document.querySelectorAll(".ShowComments")){
        btn.onclick = showAllComments;
    }
}
function showAllComments(e){
   
    const pictureId = e.target.closest("[picId]").getAttribute("picId");
    const userId = findUserId();
    if(e.target.innerText != "Add comments"){
        e.target.onclick = hideComments;  
        e.target.innerText = "Hide comments";
    }
    console.log(pictureId)
    fetch(`/api/comments?idPic=${pictureId}`).then(resp => resp.json()).then( (response) => {
        let commentsBlock = e.target.closest("[picId]").querySelector('.commentsBlock');
        commentsBlock.innerText = '';
        console.log(response);
        for(let comment of response){
            if(comment.login == null){
                comment.login = "Аноним";                
            }
            let div = document.createElement('div');

            div.setAttribute('idCom',comment.id);
            div.classList.add("comment");

            let commentText = document.createElement('span');
            commentText.innerText = comment.commentText;
            commentText.className = "commentText";

            div.appendChild(commentText);
            div.appendChild(document.createElement('br'));

            let dateTime = new Date(comment.moment);
            let dateAuthor = document.createElement('span');
            dateAuthor.innerText = `${comment.login}:${dateTime.getFullYear()}/${dateTime.getMonth()}/${dateTime.getDay()}-${dateTime.getHours()}:${dateTime.getMinutes()}`
            div.appendChild(dateAuthor);
         
            if(userId == comment.AuthorComment && userId != null){
                let btnDelete = document.createElement('button');
                btnDelete.classList.add("deleteBtn")
                btnDelete.onclick = deleteComments;
                btnDelete.innerText = 'Delete';

                let btnEdit = document.createElement("button");
                btnEdit.classList.add("editBtn");
                btnEdit.onclick = EditComments;
                btnEdit.innerText = 'Edit';
                div.appendChild(btnDelete);
                div.appendChild(btnEdit);
            }
            commentsBlock.appendChild(div);
        }
    } );
}

function EditComments(e){
   e.target.innerText = 'Save';
   e.target.onclick = saveChangesComment;
   let commentTextContainer = e.target.parentNode.querySelector(".commentText");
   commentTextContainer.setAttribute("contenteditable", true);
   commentTextContainer.savedText = commentTextContainer.innerText;
   commentTextContainer.focus();

   let btnCancel = document.createElement("button");
   btnCancel.innerText = "Reset";
   btnCancel.className = "ResetBtn"
   btnCancel.onclick = ResetChanges;
   e.target.parentNode.appendChild(btnCancel);
}
function ResetChanges(e){
    let parentContainer = e.target.parentNode.querySelector(".commentText");
    parentContainer.setAttribute("contenteditable", false);
    parentContainer.innerText = parentContainer.savedText ;
    let btnEdit = e.target.parentNode.querySelector(".editBtn");
    btnEdit.innerText = "Edit";
    btnEdit.onclick = EditComments;
    e.target.remove();
}

function saveChangesComment(e){
    
    e.target.innerText = "Edit";
    e.target.onclick = EditComments;
    let commentContainer = e.target.parentNode.querySelector(".commentText");
    if(commentContainer.innerText == commentContainer.savedText){
        alert("Changes comment can`t mush with old");
        return;
    }
    let data = {} ;
    data.newText = commentContainer.innerText;
    data.idCom = e.target.closest("[idcom]").getAttribute("idcom");

        fetch('/api/comments',{
            method: "put",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(r => r.text()).then( (res) => {
            let resObj = JSON.parse(res);
            if(! resObj.result){
                commentContainer.innerText = commentContainer.savedText;
            }
            else{
                alert("Changes was saved");
            }
        } );
    

}

function deleteComments(e){

    if(!confirm("Are you sure?")) return;
     const div = e.target.closest("div");
     const comId = div.getAttribute('idCom');
     const parentBlock = e.target.parentNode.closest("[picId]")
    fetch("/api/comments",{
        method: "delete",
        headers: {
            'Content-Type': 'application/json'
        },
        body: `{"id":"${comId}"}`
    }).then(r=>r.json()).then(j=>{

        if(typeof j.result == 'undefined' ) alert("Some error");
        else if (j.result == 1){
            div.remove();
            let countComments = parseInt(parentBlock.querySelector(".countComments").children[0].innerText);
            parentBlock.querySelector(".countComments").children[0].innerText = --countComments;
            alert("Delete completed!");
        }
        else alert("Deleted fail");
    });
}

function hideComments(e){
    e.target.innerText ='Show all comments';
    e.target.onclick = showAllComments;
    let commentsBlock = e.target.closest("[picId]").querySelector('.commentsBlock');
    let firstComment = commentsBlock.childNodes[commentsBlock.children.length - 1].childNodes[0];

    commentsBlock.innerText = firstComment.innerText;
}


document.addEventListener("galleryWindowChange", setVotesHadlers);
document.addEventListener("galleryWindowChange", setCommentsHandler);
document.addEventListener("galleryWindowChange", showCommentsHandler);
