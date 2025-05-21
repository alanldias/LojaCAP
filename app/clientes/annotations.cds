using ShopService as service from '../../srv/services';
annotate service.Clientes with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : '{i18n>nome}',
                Value : nome,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>email}',
                Value : email,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>senha}',
                Value : senha,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Target : '@UI.FieldGroup#GeneratedGroup',
            Label : '{i18n>cliente}',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : '{i18n>nome}',
            Value : nome,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>email}',
            Value : email,
        },
        {
            $Type : 'UI.DataField',
            Label : '{i18n>senha}',
            Value : senha,
        },
    ],
    UI.HeaderInfo : {
        TypeName : '{i18n>CadastroCliente}',
        TypeNamePlural : '{i18n>CadastroClientes}',
        Title : {
            $Type : 'UI.DataField',
            Value : '{i18n>CadastroCliente}',
        },
        Description : {
            $Type : 'UI.DataField',
            Value : '{i18n>OsMelhoresProdutosDo}',
        },
        ImageUrl : 'sap-icon://retail-store',
        TypeImageUrl : 'sap-icon://retail-store',
    },
    UI.FieldGroup #Pedidos : {
        $Type : 'UI.FieldGroupType',
        Data : [
        ],
    },
    UI.DeleteHidden : false,
    UI.UpdateHidden : false,
    UI.CreateHidden : false
);


