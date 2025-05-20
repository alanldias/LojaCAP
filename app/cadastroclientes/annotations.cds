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
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'LoginFacet',
            Label : '{i18n>Login}',
            Target : '@UI.Identification#LoginButton'
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
   
    UI.Identification #LoginButton : [
        {
            $Type : 'UI.DataFieldWithUrl',
            Label : 'Clique aqui para logar',
            Value : 'Login',
            Url : '/lojacap/index.html#login'
        },
    ],
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


