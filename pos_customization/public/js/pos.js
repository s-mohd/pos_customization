frappe.provide('erpnext.PointOfSale');
frappe.pages['point-of-sale'].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Point of Sale'),
        single_column: true

    });
    frappe.require('point-of-sale.bundle.js', function () {
        erpnext.PointOfSale.ItemCart = class MyItemCart extends erpnext.PointOfSale.ItemCart {
            constructor(wrapper) {
                super(wrapper);
            }

            toggle_customer_info(show) {
                if (show) {
                    const { customer } = this.customer_info || {};

                    this.$cart_container.css("display", "none");
                    this.$customer_section.css({
                        height: "100%",
                        "padding-top": "0px",
                    });
                    this.$customer_section.find(".customer-details").html(
                        `<div class="header">
                            <div class="label">${__("Contact Details")}</div>
                            <div class="close-details-btn">
                                <svg width="32" height="32" viewBox="0 0 14 14" fill="none">
                                    <path d="M4.93764 4.93759L7.00003 6.99998M9.06243 9.06238L7.00003 6.99998M7.00003 6.99998L4.93764 9.06238L9.06243 4.93759" stroke="#8D99A6"/>
                                </svg>
                            </div>
                        </div>
                        <div class="customer-display">
                            ${this.get_customer_image()}
                            <div class="customer-name-desc">
                                <div class="customer-name">${customer}</div>
                                <div class="customer-desc"></div>
                            </div>
                        </div>
                        <div class="customer-fields-container">
                            <div class="email_id-field"></div>
                            <div class="mobile_no-field"></div>
                            <div class="loyalty_program-field"></div>
                            <div class="loyalty_points-field"></div>
                            <div class="primary_address-field"></div>
                        </div>
                        <div class="transactions-label">${__("Recent Transactions")}</div>`
                    );
                    // transactions need to be in diff div from sticky elem for scrolling
                    this.$customer_section.append(`<div class="customer-transactions"></div>`);

                    this.render_customer_fields();
                    this.fetch_customer_transactions();
                } else {
                    this.$cart_container.css("display", "flex");
                    this.$customer_section.css({
                        height: "",
                        "padding-top": "",
                    });

                    this.update_customer_section();
                }
            }

            fetch_customer_details(customer) {
                if (customer) {
                    return new Promise((resolve) => {
                        frappe.db
                            .get_value("Customer", customer, ["email_id", "mobile_no", "image", "loyalty_program", "primary_address"])
                            .then(({ message }) => {
                                const { loyalty_program } = message;
                                // if loyalty program then fetch loyalty points too
                                if (loyalty_program) {
                                    frappe.call({
                                        method: "erpnext.accounts.doctype.loyalty_program.loyalty_program.get_loyalty_program_details_with_points",
                                        args: { customer, loyalty_program, silent: true },
                                        callback: (r) => {
                                            const { loyalty_points, conversion_factor } = r.message;
                                            if (!r.exc) {
                                                this.customer_info = {
                                                    ...message,
                                                    customer,
                                                    loyalty_points,
                                                    conversion_factor,
                                                };
                                                resolve();
                                            }
                                        },
                                    });
                                } else {
                                    this.customer_info = { ...message, customer };
                                    resolve();
                                }
                            });
                    });
                } else {
                    return new Promise((resolve) => {
                        this.customer_info = {};
                        resolve();
                    });
                }
            }

            render_customer_fields() {
                const $customer_form = this.$customer_section.find(".customer-fields-container");

                const dfs = [
                    {
                        fieldname: "email_id",
                        label: __("Email"),
                        fieldtype: "Data",
                        options: "email",
                        placeholder: __("Enter customer's email"),
                    },
                    {
                        fieldname: "mobile_no",
                        label: __("Phone Number"),
                        fieldtype: "Data",
                        placeholder: __("Enter customer's phone number"),
                    },
                    {
                        fieldname: "loyalty_program",
                        label: __("Loyalty Program"),
                        fieldtype: "Link",
                        options: "Loyalty Program",
                        placeholder: __("Select Loyalty Program"),
                    },
                    {
                        fieldname: "loyalty_points",
                        label: __("Loyalty Points"),
                        fieldtype: "Data",
                        read_only: 1,
                    },
                    {
                        fieldname: "primary_address",
                        label: __("Address"),
                        fieldtype: "Text",
                        placeholder: __("Enter customer's address"),
                    },
                ];

                const me = this;
                dfs.forEach((df) => {
                    this[`customer_${df.fieldname}_field`] = frappe.ui.form.make_control({
                        df: df,
                        parent: $customer_form.find(`.${df.fieldname}-field`),
                        render_input: true,
                    });
                    this[`customer_${df.fieldname}_field`].$input?.on("blur", () => {
                        handle_customer_field_change.apply(this[`customer_${df.fieldname}_field`]);
                    });
                    this[`customer_${df.fieldname}_field`].set_value(this.customer_info[df.fieldname]);
                });

                function handle_customer_field_change() {
                    const current_value = me.customer_info[this.df.fieldname];
                    const current_customer = me.customer_info.customer;
                    if (this.value && current_value != this.value && this.df.fieldname == "primary_address") {
                        frappe.db.set_value("Customer", current_customer, "primary_address", this.value).then(() => {
                            frappe.show_alert({
                                message: __("Customer address updated successfully."),
                                indicator: "green",
                            });
                            frappe.utils.play_sound("submit");
                        });
                    }
                    else if (this.value && current_value != this.value && this.df.fieldname != "loyalty_points") {
                        frappe.call({
                            method: "erpnext.selling.page.point_of_sale.point_of_sale.set_customer_info",
                            args: {
                                fieldname: this.df.fieldname,
                                customer: current_customer,
                                value: this.value,
                            },
                            callback: (r) => {
                                if (!r.exc) {
                                    me.customer_info[this.df.fieldname] = this.value;
                                    frappe.show_alert({
                                        message: __("Customer contact updated successfully."),
                                        indicator: "green",
                                    });
                                    frappe.utils.play_sound("submit");
                                }
                            },
                        });
                    }
                }
            }

        }

        wrapper.pos = new erpnext.PointOfSale.Controller(wrapper);
        window.cur_pos = wrapper.pos;
    });
};