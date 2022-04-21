/**
 *  SVGIconButtonField - SVG icons in blockly
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

class SVGIconButtonField extends Blockly.Field {
    constructor(iconUrl, width = 16, height = 16) {
        super();

        this.size_ = new Blockly.utils.Size(width, height);
        this.CURSOR = "pointer";
        this.isDirty_ = false;
        this.SERIALIZABLE = false;
        this.EDITABLE = false;

        this.iconUrl = iconUrl;

        this.clickCallbacks = [];
    }

    initView() {
        let self = this;

        this.imageElement_ = Blockly.utils.dom.createSvgElement(
            "use", {
                'height': this.size_.height + 'px',
                'width': this.size_.width + 'px',
                'alt': ""
            }, this.fieldGroup_);
        this.imageElement_.setAttributeNS(Blockly.utils.dom.XLINK_NS, 'xlink:href', this.iconUrl);
        this.imageElement_.classList.add("varvClickableIcon");
    }

    bindEvents_() {
        let self = this;

        super.bindEvents_();

        Blockly.bindEventWithChecks_(this.getClickTarget_(), 'mouseup', this,
         function (_event) {
                self.triggerCallbacks();
            }
        );
    }

    click() {
        this.triggerCallbacks();
    }

    triggerCallbacks() {
        this.clickCallbacks.forEach((callback) => {
            callback();
        });
    }

    registerClickCallback(callback) {
        this.clickCallbacks.push(callback);
    }
}

window.SVGIconButtonField = SVGIconButtonField;
