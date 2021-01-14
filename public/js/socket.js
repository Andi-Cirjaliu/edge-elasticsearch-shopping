//create a web socket connection
const socket = io();

socket.on('change', (data) => {
    console.log('change event received. Data: ', data);

    const { action, key, value} = data;
    // alert(action + ' - ' + key + ' - '+ value);

    if ( action === 'update' && value ) {
        const itemId = 'item_' + key;
        const itemObj = document.querySelector('#'+itemId);
        // console.log('item id is ', itemId, ', obj is ', itemObj);
        // alert('item id is '+ itemId + ', obj is ' + itemObj);
        if ( itemObj ) {
            //found the item to replace
            itemObj.innerHTML = value;
            return;
        }
    }

    window.location.reload();
});
