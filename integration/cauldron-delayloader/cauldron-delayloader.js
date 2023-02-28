// Run when/if Cauldron is initialized
{
    let alreadyInitializedDelayLoader = false;
    EventSystem.registerEventCallback("Cauldron.OnOpen", async ()=>{
            if (!alreadyInitializedDelayLoader){
                console.log("Fetching additional Varv packages for Cauldron integration");
                await wpm.require(["varv-cauldron", "varv-dom-highlight"]);

                // Cause a restart to update the TreeBrowser with the current Concepts
                EventSystem.triggerEvent("Varv.Restart");
                alreadyInitializedDelayLoader = true;
            }
    });    
}
