/*******************************************************************************
 * dPassword v0.1b - jQuery password-hiding iPhone-Style
 *
 * (c) copyright 2009 by DECAF�, Stefan Ullrich (http://decaf.de)
 *     Feel free to redistribute or modify this script, as long
 *     as you leave this copyright disclaimer at the top
 *
 * Known Bugs: - delete marked text will not work
 *             - deleting a single chars will not work if char is 
 *               not the last char
 *             - view will not follow cursor if textfield is too small
 *
 *******************************************************************************/

(function($){
   $.fn.dPassword = function(options) {

      var defaults = {
         interval:      200,
         duration:      3000,
         replacement:   '%u25CF',
         prefix:        'password_',
         debug:  			false
      }

      var opts    = $.extend(defaults, options);
      var checker = new Array();
      var timer   = new Array();

      $(this).each(function() {
         // get original password tag values
         var name        = $(this).attr('name');
         var id          = $(this).attr('id');
         var class       = $(this).attr('class');
         var style       = $(this).attr('style');
         var size        = $(this).attr('size');
         var maxlength   = $(this).attr('maxlength');
         var disabled    = $(this).attr('disabled');
         var tabindex    = $(this).attr('tabindex');
         var accesskey   = $(this).attr('accesskey');
         var value       = $(this).attr('value');

         // set timers
         checker.push(id);
         timer.push(id);

         // hide field
         $(this).hide();
         
         // add debug span
         if (opts.debug) {
				$(this).after('<span id="debug_' + opts.prefix + name + '" style="color: #f00;"></span>');         
         }
         // add new text field
         $(this).after(' <input name="' + (opts.prefix + name) + '" ' +
                                 'id="' +  (opts.prefix + id) + '" ' + 
                               'type="text" ' +
                              'value="' + value + '" ' +
               (class != '' ? 'class="' + class + '"' : '') +
               (style != '' ? 'style="' + style + '"' : '') +
                 (size != '' ? 'size="' + size + '"' : '') +
       (maxlength != -1 ? 'maxlength="' + maxlength + '"' : '') +
         (disabled != '' ? 'disabled="' + disabled + '"' : '') +
         (tabindex != '' ? 'tabindex="' + tabindex + '"' : '') +
 (accesskey != undefined ? 'accesskey="' + accesskey + '"' : '') +
                      'autocomplete="off" />');
         
         // change label
         $('label[for='+id+']').attr('for', opts.prefix + id);
         // disable tabindex
         $(this).attr('tabindex', '');
         // disable accesskey
         $(this).attr('accesskey', '');


         // bind event
         $('#' + opts.prefix + id).bind('focus', function(event) {
            clearTimeout(checker[getId($(this).attr('id'))]);
            checker[getId($(this).attr('id'))] = setTimeout("check('" + getId($(this).attr('id')) + "', '', true)", opts.interval);
         });
         $('#' + opts.prefix + id).bind('blur', function(event) {
            clearTimeout(checker[getId($(this).attr('id'))]);
         });

			check(getId($(this).attr('id')), '', true);
      });

      getId = function(id) {
         var pattern = opts.prefix+'(.*)';
         var regex = new RegExp(pattern);
         regex.exec(id);
         id = RegExp.$1;
         
         return id;
      }
   
      setPassword = function(id, str) {
         var tmp = '';
         for (i=0; i < str.length; i++) {
            if (str.charAt(i) == unescape(opts.replacement)) {
               tmp = tmp + $('#' + id).val().charAt(i);
            }
            else {
               tmp = tmp + str.charAt(i);
            }
         }
         $('#' + id).val(tmp);
      }
      
      check = function(id, oldValue, intialCall) {
         var bullets = $('#' + opts.prefix + id).val();

         if (oldValue != bullets) {
            setPassword(id, bullets);
            if (bullets.length > 1) {
               var tmp = '';
               for (i=0; i < bullets.length-1; i++) {
                  tmp = tmp + unescape(opts.replacement);
               }
               tmp = tmp + bullets.charAt(bullets.length-1);
   
               $('#' + opts.prefix + id).val(tmp);
            }
            else {
            }
            clearTimeout(timer[id]);
            timer[id] = setTimeout("convertLastChar('" + id + "')", opts.duration);
         }
         if (opts.debug) {
         	$('#debug_' + opts.prefix + id).text($('#' + id).val());
         }
         if (!initialCall) {
	         checker[id] = setTimeout("check('" + id + "', '" + $('#' + opts.prefix + id).val() + "')", opts.interval);
			}
      }
      
      convertLastChar = function(id) {
         if ($('#' + opts.prefix + id).val() != '') {
            var tmp = '';
            for (i=0; i < $('#' + opts.prefix + id).val().length; i++) {
               tmp = tmp + unescape(opts.replacement);
            }
   
            $('#' + opts.prefix + id).val(tmp);
         }
      }
   };
}) (jQuery);
