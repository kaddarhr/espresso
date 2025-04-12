const INPUT_HTML = `
	<input type="file">
`

frappe.ui.form.ControlAttach = class ControlAttach extends frappe.ui.form.ControlData {
	uploader = null

	make_input() {
		let me = this;
		this.$input = $(INPUT_HTML)
			.prependTo(me.input_area)

		this.$value = $(
			`<div class="attached-file flex justify-between align-center">
				<div class="ellipsis">
				${frappe.utils.icon("es-line-link", "sm")}
					<a class="attached-file-link" target="_blank"></a>
				</div>
				<div>
					<a class="btn btn-xs btn-default" data-action="clear_attachment">${__("Clear")}</a>
				</div>
			</div>`
		)
			.prependTo(me.input_area)
			.toggle(false);

		this._init_file_uploader()

		this.input = this.$input.get(0);
		this.set_input_attributes();
		this.has_input = true;

		frappe.utils.bind_actions_with_object(this.$value, this);
		this.toggle_reload_button();
	}

	clear_attachment() {
		let me = this;
		if (this.frm) {
			me.parse_validate_and_set_in_model(null);
			me.refresh();
			me.frm.attachments.remove_attachment_by_filename(me.value, async () => {
				await me.parse_validate_and_set_in_model(null);
				me.refresh();
				me.frm.doc.docstatus == 1 ? me.frm.save("Update") : me.frm.save();
			});
		} else {
			this.dataurl = null;
			this.fileobj = null;
			this.set_input(null);
			this.parse_validate_and_set_in_model(null);
			this.refresh();
		}
	}

	set_input(value, dataurl) {
		this.last_value = this.value;
		if (value) {
			this.value = value.replace("/files/", "");
		}
		if (!this.value) {
			this.$input.toggle(true);
			this.$value.toggle(false);
			return
		}
		// value can also be using this format: FILENAME,DATA_URL
		// Important: We have to be careful because normal filenames may also contain ","
		if (this._is_dataurl(value)) {
			const file_url_parts = this.value.match(/^([^:]+),(.+):(.+)$/);
			this.value = file_url_parts[1]
			dataurl = file_url_parts[2] + ":" + file_url_parts[3]
		}
		if (!this.$input || !this.$value) {
			console.error(`Attachment input state corrupt.`)
			this.$wrapper.html(`
					  <div class="attached-file flex justify-between align-center">
						<div class="ellipsis">
						  <a href="${dataurl || this.value}" target="_blank">${filename || this.value}</a>
						</div>
					  </div>
				`);
		}

		this._remove_file_uploader()
		this.$value
			.toggle(true)
			.find(".attached-file-link")
			.html(this.value)
			.attr("href", dataurl || this.value);
	}

	get_value() {
		return this.value || null;
	}
	toggle_reload_button() {
		this.$value
			.find('[data-action="reload_attachment"]')
			.toggle(this.file_uploader && this.file_uploader.uploader.files.length > 0);
	}

	_is_dataurl(value) {
		return !!this.value.match(/^([^:]+),(.+):(.+)$/);
	}

	_init_file_uploader() {
		// FilePond.registerPlugin(FilePondPluginImagePreview)
		this.uploader = FilePond.create(this.$input.get(0), {
			name: this.df.fieldname,
			required: this.df.reqd,
			server: {
				process: (fieldName, file, metadata, load, error, progress, abort, transfer, options) => {
					// fieldName is the name of the input field
					// file is the actual file object to send

					const request = new XMLHttpRequest();
					request.open('POST', '/api/method/upload_file', true);
					request.setRequestHeader("Accept", "application/json");
					request.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token);

					const formData = new FormData();
					formData.append("file", file, file.name);
					formData.append("is_private", false);
					formData.append("file_name", file.name);
					formData.append("doctype", this.frm.doctype);
					formData.append("docname", this.frm.docname);
					formData.append("fieldname", this.df.fieldname);
					// Should call the progress method to update the progress to 100% before calling load
					// Setting computable to false switches the loading indicator to infinite mode
					request.upload.onprogress = (e) => {
						progress(e.lengthComputable, e.loaded, e.total);
					};

					// Should call the load method when done and pass the returned server file id
					// this server file id is then used later on when reverting or restoring a file
					// so your server knows which file to return without exposing that info to the client
					request.onload = function () {
						if (request.status >= 200 && request.status < 300) {
							// the load method accepts either a string (id) or an object
							const data = JSON.parse(request.response);
							load(data.message.file_name);
						} else {
							// Can call the error method if something is wrong, should exit after
							error('oh no');
						}
					};

					request.send(formData);

					// Should expose an abort method so the request can be cancelled
					return {
						abort: () => {
							// This function is entered if the user has tapped the cancel button
							request.abort();

							// Let FilePond know the request has been cancelled
							abort();
						},
					};
				},
				load: (source, load, error, progress, abort, headers) => {
					const file = fetch(`/files/${source}`)
						.then((res) => res.arrayBuffer())
						.then((buffer) => new File([buffer], source));
					error('oh my goodness');
					progress(true, 0, 1024);
					load(file);

					// Should expose an abort method so the request can be cancelled
					return {
						abort: () => {
							// User tapped cancel, abort our ongoing actions here

							// Let FilePond know the request has been cancelled
							abort();
						},
					};
				},
			},
			credits: false
		})
	}

	_remove_file_uploader() {
		if (!this.uploader) return
		this.uploader.destroy();
		if (!this.$input) return
		this.$input.toggle(false);
	}
};
