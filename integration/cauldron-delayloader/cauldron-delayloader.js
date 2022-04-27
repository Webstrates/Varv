// Run when/if Cauldron is initialized
{
    let alreadyInitializedDelayLoader = false;
    EventSystem.registerEventCallback("Cauldron.OnOpen", async ()=>{
            if (!alreadyInitializedDelayLoader){
                await wpm.require("varv-cauldron");

                // Cause a restart to update the TreeBrowser with the current Concepts
                EventSystem.triggerEvent("Varv.Restart");
                alreadyInitializedDelayLoader = true;
            }
    });    
}
