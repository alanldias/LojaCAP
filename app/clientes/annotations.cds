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
            Label : 'Cadastro',
            Target : '@UI.FieldGroup#GeneratedGroup',
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
        TypeName : '{i18n>cadastroCliente}',
        TypeNamePlural : '{i18n>cadastroClientes}',
        Title : {
            $Type : 'UI.DataField',
            Value : nome,
        },
    },
);

