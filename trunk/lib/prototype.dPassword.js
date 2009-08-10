/*******************************************************************************
 * dPassword v0.7 - delayed password masking (iPhone style)
 *                  Prototype version
 *
 * Usage:
 *    <code>new dPassword(element, options)</code>, where element is a DOM element or it's ID.
 *    The options parameter is optional and can have the following optional entries:
 *        delay:					Number of seconds after which to hide input. Defaults to 1.
 *        observeForm:				Whether to automatically deactivate when parent form is submitted (default: true).
 *        form:						Form element different from parent form to observe for submitting (forces observeForm to true if set).
 *        cloakingCharacter:		Character to replace entered characters with. Defaults to the bullet (•).
 *        onChange:   				Handler when password has been changed.
 *        onStateChange:   			Handler when masking behaviour changes.
 *        switchToPasswordType:		Whether to switch input field back to password type on blur (looks bad in IE).
 *		  showIcon: 				Show a lock icon allowing the user to toggle masking behaviour (defaults to true).
 *									See class properties
 * 										ICON_TITLE_ON, ICON_TITLE_OFF, ICON_PATH, ICON_STYLES, ICON_STYLES_ON, ICON_STYLES_OFF
 * 									for customization.
 *
 * Licensed under MIT License.
 *
 * Copyright (c) 2009 DECAF°, Julian Dreissig (http://decaf.de)
 *
 * Permission is hereby granted, free of charge, to any person obtaining 
 * a copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be 
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES 
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR 
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Known Issues: - view will not follow cursor if textfield is too small.
 *
 * @requires Prototype Library >= 1.6 (may work with older versions)
 */
var dPassword = Class.create({
	
	_input: null,
	_previousInputValue: null,
	_value: null,
	_timeout: null,
	_previousSelection: null,
	_options: null,
	_observing: false,
	_form: null,
	_toggleIcon: null,	
	_keysDown: null,
	
	/**
	 * @constructor
	 */
	initialize: function(field, options) {
		
		this._input = $(field);
		this._keysDown = {};
		
		this._options = Object.extend({
			delay: 1,
			observeForm: true,
			form: null,
			cloakingCharacter: (navigator.platform == "MacIntel") ? '\u2022' : '\u25CF',		 
			showIcon: true,
			onChange: Prototype.emptyFunction,
			onStateChange: Prototype.emptyFunction, 
			switchToPasswordType: !Prototype.Browser.IE	// avoid style glitches in IE6	 
		}, options);
		this._options.cloakingCharacter = this._options.cloakingCharacter.charAt(0);
		
		// register event listeners
		this._registerHandlers(this._input);
		if (this._options.observeForm || this._options.form) {
			if (!this._form) this._form = this._options.form ? $(this._options.form) : this._input.up('form');
			if (this._form) this._form.observe("submit", this.deactivate.bind(this, true));
		}

		// create/handle toggle icon
		if (this._options.showIcon) {
			this._toggleIcon = new Element('div', {className: "dpassword-lock"});
			this._toggleIcon.setStyle({backgroundImage: "url(" + (this._options.iconPath || dPassword.ICON_PATH) + ")"});
			this._toggleIcon.setStyle(dPassword.ICON_STYLES);
			this._input.insert({after: this._toggleIcon});
			this._toggleIcon.observe("click", (function() {
				this._observing ? this.deactivate() : this.activate();
				this._input.focus();
			}).bind(this));
		}

		// rock'n'roll
		this.activate();
	},
	
	/**
	 * Returns the current value of the password field.
	 */
	getValue: function() {
		return this._observing ? this._value : $F(this._input);
	},
	
	/**
	 * Switches to active mode. Will be automatically called on initialization.
	 * Use getValue() to retrieve field value once activated.
	 */
	activate: function() {
		if (!this._observing) this._observing = true;
		this._value = $F(this._input);
		this._cloakInput();
		if (this._toggleIcon) this._switchToggleIcon(true);
		this._options.onStateChange(this._observing, this, this._toggleIcon);
	},
	
	/**
	 * Deactivates dPassword temporarily/permanently and switches field back to normal password behaviour
	 * to e.g. perform DOM operations or value retrieval.
	 * IMPORTANT: If "temporarily" parameter is set to true will auto-reactivates on any input.
	 */
	deactivate: function(temporarily) {
		if (this._observing) {
			if (this._timeout) {
				clearTimeout(this._timeout);
				this._timeout = null;
			}
			var selection = this._getFieldSelection();
			Prototype.Browser.IE ? this._switchInputTypeIE("password") : this._input.setAttribute("type", "password");
			this._input.value = this.getValue();
			if (document.activeElement && document.activeElement == this._input) this._setFieldSelection(selection);
			if (temporarily !== true) {
				this._observing = false;
				if (this._toggleIcon) this._switchToggleIcon(false);
				this._options.onStateChange(this._observing, this, this._toggleIcon);
			}
		}
	},
	
	_keyDownHandler: function(event) {
		if (this._observing) {
			if (!(this._isSpecialKey(event.keyCode) || event.metaKey || event.ctrlKey)) {
				var keyCode = null;
				for (var keyCode in this._keysDown) {
					this._afterInputHandler(keyCode);
				}
				this._storeSelection();
				if (!keyCode) this._cloakInput();
				if (event.keyCode > 10) this._keysDown[event.keyCode] = true;
			} else {
				this._storeSelection();
				if (this._timeout) {
					clearTimeout(this._timeout);
					this._timeout = null;
					this._cloakInput();
				}
			}
		}
	},
	
	_keyUpHandler: function(event) {
		if (this._observing) {
			if (event.type == "paste") return this._afterInputHandler.bind(this).defer();
	    	if (this._isSpecialKey(event.keyCode) || event.metaKey || event.ctrlKey) return;
			if (this._keysDown[event.keyCode] || event.keyCode < 11) this._afterInputHandler(event);
		} else {
			var value = $F(this._input);
			if (value != this._previousInputValue) {
				this._previousInputValue = value;
				this._options.onChange(value);
			}
		}
	},
	
	_afterInputHandler: function(keyCode) {
		delete this._keysDown[keyCode];
		var value = $F(this._input);
		var selection = this._getFieldSelection();

		if (this._previousInputValue != value) {
			var sStart = this._previousSelection[0],
				sEnd = this._previousSelection[1],
				sLength = this._previousSelection[2],
				lengthDifference = value.length - this._value.length,	// > 0: characters added
				newValue;			
			if (lengthDifference < 0 && sLength == 0) {		// single character deletion
				if (sStart == selection[0])	{				// forward deletion
					newValue = this._value.substring(0, sStart) + this._value.substring(sEnd + 1);
				} else {									// has to be backward deletion
					newValue = this._value.substring(0, selection[0]) + this._value.substring(sEnd);
				}
			} else {										// a selection has been replaced/deleted
				newValue = this._value.substring(0, sStart) + value.substring(sStart, selection[1]) + this._value.substring(sEnd);
			}
			this._value = newValue;
			// console.info("new value: " + this._value);
			this._options.onChange(this.getValue());

			if (this._timeout) {
				clearTimeout(this._timeout);
				this._timeout = null;
			}

			if (lengthDifference >= 0) {
				// leave newly written part uncloaked
				this._cloakInput([sStart + 1, selection[1]]);
				this._timeout = this._cloakInput.bind(this).delay(this._options.delay);
			}
		} else {
			this._previousSelection = selection;
		}
	},
	
	_registerHandlers: function(el) {
		el.observe("keydown", this._keyDownHandler.bindAsEventListener(this));
		el.observe("keyup", this._keyUpHandler.bindAsEventListener(this));
		el.observe("paste", this._keyUpHandler.bindAsEventListener(this));
		el.observe("select", this._storeSelection.bind(this));
		el.observe("focus", this._storeSelection.bind(this));	
		if (this._options.switchToPasswordType) {
			el.observe("blur", this.deactivate.bind(this, true));		
		}		
	},
	
	_storeSelection: function() {
		if (this._observing) this._previousSelection = this._getFieldSelection();
	},
	
	_cloakInput: function(keepRange) {
		var selection = this._getFieldSelection();
		var value = $F(this._input);
		if (keepRange) {
			this._input.value = value.substring(0, keepRange[0] - 1 ).replace(/./g, this._options.cloakingCharacter) + value.substring(keepRange[0] - 1, keepRange[1]) + value.substring(keepRange[1]).replace(/./g, this._options.cloakingCharacter);
		} else {
			this._input.value = value.replace(/./g, this._options.cloakingCharacter);
			if (this._input.getAttribute("type") != "text") {
				if (Prototype.Browser.IE) {
					this._switchInputTypeIE("text");
				} else {
					this._input.setAttribute("type", "text");
				}
				this._input.setAttribute("autocomplete", "off");
			}
		}
		if (document.activeElement && document.activeElement == this._input) this._setFieldSelection(selection);
		this._previousInputValue = $F(this._input);
	},
	
	_switchInputTypeIE: function(toType) {
		// create input field (or retrieve from cache) with new type
		var newInput;
		if (!this._inputFieldTypes) {
			newInput = this._input.cloneNode(true);
			var tempDiv = new Element('div', {style: "display: none"});
			tempDiv.insert(newInput);
			if (toType == "password") {
				tempDiv.update(tempDiv.innerHTML.replace(/>/, 'type="password">'));
			} else {
				tempDiv.update(tempDiv.innerHTML.replace(/type="?password"?/, 'type="text"'));
			}
			newInput = tempDiv.down();
			this._registerHandlers(newInput);
		} else {
			newInput = this._inputFieldTypes[toType];
		}
		
		// update field
		newInput.setStyle({width: (this._input.clientWidth - 2*parseInt(this._input.currentStyle.padding, 10)) + "px"});	// fixing different widths for password and text inputs in IE
		newInput.setStyle({height: (this._input.clientHeight - 2*parseInt(this._input.currentStyle.padding, 10)) + "px"});	// fixing different widths for password and text inputs in IE
		var oldInput = this._input.replaceNode(newInput);
		this._input = newInput;
		this._input.value = oldInput.value;

		// store elements in cache, if available
		if (!this._inputFieldTypes) {
			this._inputFieldTypes = {
				password: (toType == "password") ? newInput : oldInput,
				text: (toType == "password") ? oldInput : newInput
			};
		}
	},
	
	_switchToggleIcon: function(state) {
		if (state) {
			this._toggleIcon.setStyle(dPassword.ICON_STYLES_OFF).removeClassName("dpassword-lock-closed");
			this._toggleIcon.setAttribute('title', dPassword.ICON_TITLE_ON);
		} else {
			this._toggleIcon.setStyle(dPassword.ICON_STYLES_ON).addClassName("dpassword-lock-closed");
			this._toggleIcon.setAttribute('title', dPassword.ICON_TITLE_OFF);
		}
	},
	
	/**
	 * Retrieves the coordinates of the current selection or cursor position.
	 * TODO: make this static.
	 * @returns [selStart, selEnd, selLength]
	 * @private
	 */
	_getFieldSelection: function() {
		if (document.selection) {
			var range = document.selection.createRange();
			var length = range.text.length;
			range.moveStart('character', -this._input.value.length);	// Move selection start to 0 position
			var cursorPos = range.text.length;	// The caret position is now the selection length
			return [cursorPos - length, cursorPos, length];
		} else {
			return [this._input.selectionStart, this._input.selectionEnd, this._input.selectionEnd - this._input.selectionStart];
		}
	},
	
	/**
	 * Sets the current selection or cursor position in the password field.
	 * TODO: make this static.
	 * @param {SelectionArray} selection Array of form [startPosition, endPosition].
	 * @private
	 */
	_setFieldSelection: function(selection) {
		if (document.selection) {
			var range = this._input.createTextRange();
			range.collapse();
			range.moveStart('character', selection[0]);
			range.moveEnd('character', selection[1] - selection[0]);
			range.select();
		} else {
			this._input.selectionStart = selection[0];
			this._input.selectionEnd = selection[1];
		}
	},
	
	/**
	 * Identify some special keys (cursor keys, tab, shift, ctrl, apple).
	 * Doesn't filter out backspace and delete!
	 * @private
	 * @param {Number} keyCode The keycode of the key to be checked.
	 * @returns True if key is a "special" key.
	 * @type Boolean
	 */
	_isSpecialKey: function(keyCode) {
		// TODO: Need to check OS? Windows key?
		return (keyCode >= 9 && keyCode <= 20) || (keyCode >= 33 && keyCode <= 40) || keyCode == 224;
	}
});

Object.extend(dPassword, {
	/*
	 * Default styles and behaviours for lock icon, see showIcon option.
	 * Override at will.
	 */
	ICON_TITLE_ON: "Delayed masking active, click here to switch off.",
	ICON_TITLE_OFF: "Click to activate delayed masking of input.",
	ICON_STYLES: {
		display: "inline",
		position: "absolute",
		width: "16px", height: "16px",
		margin: "-10px 0 0 -12px",
		overflow: "hidden", cursor: "pointer",
		backgroundRepeat: "no-repeat"
	},
	ICON_PATH: "lock.gif",		// set to your position of icon
	ICON_STYLES_OFF: {
		backgroundPosition: "0 0"
	},
	ICON_STYLES_ON: {
		backgroundPosition: "0 -16px"
	}
});