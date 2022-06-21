/**
 *  VarvScriptFragment - A simpler scripting language for Varv
 * 
 *  This code is licensed under the MIT License (MIT).
 *  
 *  Copyright 2020, 2021, 2022 Rolf Bagge, Janus B. Kristensen, CAVI,
 *  Center for Advanced Visualization and Interaction, Aarhus University
 *  
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the “Software”), to deal
 *  in the Software without restriction, including without limitation the rights 
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
 *  copies of the Software, and to permit persons to whom the Software is 
 *  furnished to do so, subject to the following conditions:
 *  
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *  
 *  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
 *  THE SOFTWARE.
 *  
 */

wpm.onRemoved(()=>{
    Fragment.unRegisterFragmentType(VarvScriptFragment);
});
/**
 * A fragment that contains Varv code
 *
 * Supports auto - executes require() on load
 * @extends Fragments.Fragment
 * @hideconstructor
 * @memberof Fragments
 */
class VarvScriptFragment extends Fragment {
    constructor(html) {
        super(html);
    }

    async require(options = {}) {
        console.log("Trying to parse",this.raw);
        let result = parseVarvScript(this.raw);
        console.log("Parsed to ", result);
        return result;
    }

    supportsAuto() {
        return true;
    }

    static type() {
        return "text/varvscript";
    }
};
window.VarvScriptFragment = VarvScriptFragment;
Fragment.registerFragmentType(VarvScriptFragment);