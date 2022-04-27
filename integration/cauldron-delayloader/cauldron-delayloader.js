// Run when/if Cauldron is initialized
EventSystem.registerEventCallback("Cauldron.OnOpen", async ()=>{
        await wpm.require("varv-cauldron");
        
        // Cause a restart to update the TreeBrowser with the current Concepts
        EventSystem.triggerEvent("Varv.Restart");
});