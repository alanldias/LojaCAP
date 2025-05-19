using ShopService as service from '../../srv/services';
annotate service.Clientes with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Nome}',
                Value : nome,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Email}',
                Value : email,
            },
            {
                $Type : 'UI.DataField',
                Label : '{i18n>Senha}',
                Value : senha,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : '{i18n>Cadastrese}',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.HeaderInfo : {
        TypeName : '{i18n>CadastroCliente}',
        TypeNamePlural : '{i18n>CadastroClientes}',
        Title : {
            $Type : 'UI.DataField',
            Value : '{i18n>Titulo}',
        },
        Description : {
            $Type : 'UI.DataField',
            Value : '{i18n>OsMelhoresProdutosDo}',
        },
        TypeImageUrl : 'sap-icon://retail-store',
    },
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForIntentBasedNavigation',
            SemanticObject: 'Login',
            Action : 'display',
            Label : 'Logar',
        },
    ],
    UI.UpdateHidden : true,
    UI.DeleteHidden : true,
);

annotate service.Clientes with {
    nome @Common.FieldControl : #Mandatory
};

annotate service.Clientes with {
    email @Common.FieldControl : #Mandatory
};

annotate service.Clientes with {
    senha @Common.FieldControl : #Mandatory
};


