document.addEventListener("DOMContentLoaded",()=>{
    fetch("/api/picture?deleted")
    .then(r=>r.text())
    .then(t=>{
        // console.log(t);
        const j = JSON.parse(t);
        const cont = document.getElementById("gallery-container");
        fetch("/templates/picture_junk.tpl").then(r=>r.text()).then(tpl=>{
            var html = "";
            for(let p of j){
                html += tpl.replace("{{id}}",p.id_str)
                           .replace("{{title}}",p.title)
                           .replace("{{description}}",p.description)
                           .replace("{{place}}",p.place)
                           .replace("{{filename}}",p.filename);
            }
            cont.innerHTML = html;
            addToolbuttonListeners();
        });
    });
});

async function addToolbuttonListeners() {
    for(let b of document.querySelectorAll(".tb-recover"))
        b.addEventListener("click",tbRecover);
}
function tbRecover(e) {
    const div = e.target.closest("div");
    const picId = div.getAttribute("picId");
    console.log(picId);
    fetch("/api/picture",{
        method: "put",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: picId,
            delete_DT: null
        })
    }).then(r=>r.json()).then(console.log /*j=>{
        // в ответе сервера должно быть поле result, в нем (affectedRows)
        // если 1 - было удаление, 0 - не было
        if(typeof j.result == 'undefined' ) alert("Some error");
        else if (j.result == 1){
            // удалить div из контейнера картин
            div.remove();
            alert("Delete completed!");
        }
        else alert("Deleted fail");
    }*/);
}